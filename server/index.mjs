import http from 'node:http';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {assertPublicUrl} from './security.mjs';
import {extractDesigns} from './extract.mjs';
import {createPublicProxy} from './proxy.mjs';

const port=Number(process.env.PORT||10000),allowed=[...(process.env.ALLOWED_ORIGIN||'https://observl.github.io').split(',').map(s=>s.trim()),process.env.RENDER_EXTERNAL_URL,'http://localhost:'+port,'http://127.0.0.1:'+port].filter(Boolean);
let active=0;const maxConcurrent=Math.max(1,Math.min(Number(process.env.MAX_CONCURRENT)||1,3));
const recent=new Map();
function send(res,status,body,origin){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
async function readJson(req){let body='';for await(const b of req){body+=b;if(body.length>4096)throw new Error('请求内容过长。')}try{return JSON.parse(body)}catch{throw new Error('请求格式不正确。')}}
export async function analyze(raw) {
  const target=await assertPublicUrl(raw);
  const proxy=await createPublicProxy();let browser;
  try{browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),proxy:{server:proxy.server,bypass:'<-loopback>'},args:['--disable-dev-shm-usage','--disable-quic','--disable-features=WebRtcHideLocalIpsWithMdns','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
  }catch(error){proxy.close();throw error}
  let timer;try{
    const context=await browser.newContext({viewport:{width:1365,height:900},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false,ignoreHTTPSErrors:false});
    // Limit every document, redirect and asset request to public HTTP(S) hosts.
    await context.route('**/*',async route=>{
      const request=route.request();
      if(['media','websocket','eventsource'].includes(request.resourceType())||!['GET','HEAD'].includes(request.method()))return route.abort();
      try{await assertPublicUrl(request.url());await route.continue()}catch{await route.abort()}
    });
    const page=await context.newPage();
    page.on('dialog',d=>d.dismiss().catch(()=>{}));
    const work=(async()=>{
      const response=await page.goto(target.href,{waitUntil:'domcontentloaded',timeout:35000});
      if(response&&response.status()>=400)throw new Error('目标网页返回 HTTP '+response.status()+'，无法抓取。');
      await page.waitForTimeout(1600);
      // Scroll to load lazy content without interacting with forms or consenting to dialogs.
      for(let y=0;y<12000;y+=850){const h=await page.evaluate(()=>document.documentElement.scrollHeight);if(y>h)break;await page.evaluate(v=>scrollTo(0,v),y);await page.waitForTimeout(100)}
      await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(400);
      const data=await page.evaluate(extractDesigns);
      const text=await page.locator('body').innerText({timeout:5000});
      if(/verify you are human|checking your browser|just a moment|access denied|captcha/i.test(text.slice(0,1800))&&data.fragments.length<3)throw new Error('目标网站要求人机验证或限制自动访问，无法完成抓取。');
      if(!data.fragments.length)throw new Error('页面已加载，但没有识别到可展示的设计区域。页面可能需要登录或仍未渲染。');
      const height=Math.max(1,data.pageHeight);
      const screenshot=await page.screenshot({type:'jpeg',quality:42,clip:{x:0,y:0,width:1365,height},timeout:15000,animations:'disabled'});
      const fragments=[];
      const batchId=Date.now();
      for(let i=0;i<data.fragments.length;i++){
        const f=data.fragments[i];const clip={x:f.rect.x,y:f.rect.y,width:Math.min(f.rect.width,1365-f.rect.x),height:Math.min(f.rect.height,height-f.rect.y)};
        if(clip.width<1||clip.height<1)continue;
        try{const image=await page.screenshot({type:'jpeg',quality:42,clip,timeout:5000,animations:'disabled'});fragments.push({...f,id:batchId+i,image:'data:image/jpeg;base64,'+image.toString('base64'),source:page.url(),capturedAt:new Date().toISOString()})}catch{}
      }
      if(!fragments.length)throw new Error('设计区域截图失败，请尝试其他网页。');
      return {source:page.url(),title:data.title,width:1365,height,capturedAt:new Date().toISOString(),screenshot:'data:image/jpeg;base64,'+screenshot.toString('base64'),fragments,method:'DOM 与计算样式规则识别；不包含 AI 审美评价、悬停验证或动效录制。',truncated:data.pageHeight>=14000};
    })();
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('抓取超时，请尝试内容更少的页面。')),85000)});
    return await Promise.race([work,timeout]);
  } finally {clearTimeout(timer);await browser.close();proxy.close()}
}
const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin||'';
  if(req.method==='OPTIONS'){res.writeHead(204,{...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}:{})});return res.end()}
  if(req.url==='/health')return send(res,200,{ok:true,service:'designbreakdown',version:2},origin);
  if(req.url==='/'&&req.method==='GET'){try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await fs.readFile(new URL('../index.html',import.meta.url)))}catch{send(res,404,{error:'首页不存在'},origin)}return}
  if(req.url!=='/api/analyze'||req.method!=='POST')return send(res,404,{error:'接口不存在'},origin);
  if(origin&&!allowed.includes(origin))return send(res,403,{error:'当前来源未获允许。'},origin);
  const ip=req.socket.remoteAddress,now=Date.now();
  for(const [key,t] of recent)if(now-t>60000)recent.delete(key);
  if(active>=maxConcurrent)return send(res,429,{error:'抓取服务正忙，请稍后重试。'},origin);
  if(recent.has(ip)&&now-recent.get(ip)<5000)return send(res,429,{error:'请求过于频繁，请稍后重试。'},origin);
  active++;recent.set(ip,now);
  try{const {url}=await readJson(req);const result=await analyze(url);send(res,200,result,origin)}
  catch(e){console.error('Analysis failed:',e.message);send(res,422,{error:e.message?.includes('net::')?'目标网页无法连接或拒绝自动访问，请尝试其他公开网址。':e.message||'抓取失败。'},origin)}
  finally{active--}
});
server.requestTimeout=100000;server.headersTimeout=10000;
server.listen(port,'0.0.0.0',()=>console.log('DesignBreakdown listening on '+port));
