import dns from 'node:dns/promises';
import net from 'node:net';
export function isPublicAddress(address) {
  const a=address.toLowerCase().replace(/^\[|\]$/g,'');
  if(net.isIP(a)===4) {
    const [x,y]=a.split('.').map(Number);
    return !(x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&(y===168||y===0)||x===100&&y>=64&&y<=127||x===198&&(y===18||y===19));
  }
  // Only globally routable IPv6 unicast; reject mapped IPv4, local and translation ranges.
  return net.isIP(a)===6 && /^[23][0-9a-f]{3}:/.test(a) && !a.startsWith('2001:db8:');
}
export function parseTarget(raw) {
  let url;try{url=new URL(raw)}catch{throw new Error('请输入完整的网页地址。')}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!['','80','443'].includes(url.port))throw new Error('仅支持不含账号密码、使用标准端口的公开 HTTP/HTTPS 网页。');
  const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||!host.includes('.')&&net.isIP(host)!==6)throw new Error('不支持本机或内网地址。');
  if(net.isIP(host)&&!isPublicAddress(host))throw new Error('不支持本机或内网地址。');
  return url;
}
export async function assertPublicUrl(raw,lookup=dns.lookup) {
  const url=parseTarget(raw);
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const records=net.isIP(host)?[{address:host}]:await lookup(host,{all:true,verbatim:true});
  if(!records.length||records.some(r=>!isPublicAddress(r.address)))throw new Error('目标域名指向受限制的网络地址。');
  return url;
}
