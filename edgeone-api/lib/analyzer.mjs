import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
import {assertPublicUrl} from './security.mjs';
import {createPublicProxy} from './proxy.mjs';
import {extractDesigns} from './extract.mjs';
export async function analyze(raw) {
  const target=await assertPublicUrl(raw);
  const proxy=await createPublicProxy();let browser;
  try{browser=await playwright.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||await chromium.executablePath(),proxy:{server:proxy.server,bypass:'<-loopback>'},args:[...(!process.env.CHROMIUM_EXECUTABLE?chromium.args.filter(a=>!a.includes('disable-web-security')&&!a.includes('allow-running-insecure-content')):[]),'--disable-dev-shm-usage','--disable-quic','--disable-features=WebRtcHideLocalIpsWithMdns','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
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
      const batchId=Date.now();
      const fragments=data.fragments.filter(f=>f.rect.width>0&&f.rect.height>0&&f.rect.y<height).map((f,i)=>({...f,id:batchId+i,image:'',source:page.url(),capturedAt:new Date().toISOString()}));
      if(!fragments.length)throw new Error('未找到有效设计区域。');
      return {source:page.url(),title:data.title,cropOnClient:true,width:1365,height,capturedAt:new Date().toISOString(),screenshot:'data:image/jpeg;base64,'+screenshot.toString('base64'),fragments,method:'DOM 与计算样式规则识别；不包含 AI 审美评价、悬停验证或动效录制。',truncated:data.pageHeight>=14000};
    })();
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('抓取超时，请尝试内容更少的页面。')),85000)});
    return await Promise.race([work,timeout]);
  } finally {clearTimeout(timer);await browser.close();proxy.close()}
}
