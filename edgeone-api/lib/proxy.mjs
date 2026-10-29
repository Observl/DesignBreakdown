import http from 'node:http';
import net from 'node:net';
import dns from 'node:dns/promises';
import {parseTarget,isPublicAddress} from './security.mjs';
async function destination(raw) {
  const url=parseTarget(raw),host=url.hostname.replace(/^\[|\]$/g,'');
  const records=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await dns.lookup(host,{all:true,verbatim:true});
  if(!records.length||records.some(r=>!isPublicAddress(r.address)))throw new Error('Private destination');
  return {url,address:records[0].address,family:records[0].family};
}
// Resolve once, validate, then connect to that exact IP to prevent DNS rebinding.
export async function createPublicProxy() {
  const sockets=new Set();
  const proxy=http.createServer(async(req,res)=>{
    let upstream;try{
      const {url,address,family}=await destination(req.url);
      if(url.protocol!=='http:')throw new Error('Use CONNECT for TLS');
      const headers={...req.headers,host:url.host};delete headers['proxy-authorization'];delete headers['proxy-connection'];
      upstream=http.request({host:address,family,port:80,path:url.pathname+url.search,method:req.method,headers,timeout:20000},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
      upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end()});
      req.pipe(upstream);
    }catch{res.writeHead(403);res.end('Blocked destination')}
  });
  proxy.on('connect',async(req,client,head)=>{
    try{
      // CONNECT authority has no path or userinfo. Only standard HTTPS tunnels.
      const {url,address,family}=await destination('https://'+req.url);
      if(url.pathname!=='/'||url.search||url.hash||url.port&&url.port!=='443')throw new Error('Invalid tunnel');
      const upstream=net.connect({host:address,port:443,family});
      sockets.add(upstream);upstream.on('close',()=>sockets.delete(upstream));
      upstream.setTimeout(25000,()=>upstream.destroy());
      upstream.on('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client)});
      upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());
    }catch{client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')}
  });
  proxy.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s))});
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
  return {server:'http://127.0.0.1:'+proxy.address().port,close:()=>{for(const s of sockets)s.destroy();proxy.close()}};
}
