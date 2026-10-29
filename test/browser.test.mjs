import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import {extractDesigns} from '../server/extract.mjs';
import {createPublicProxy} from '../server/proxy.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const launch=()=>chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const fixture='<!doctype html><html><head><title>真实结构测试页</title><style>body{margin:0}nav{display:flex;gap:20px;height:70px;background:#112b22;color:white}section{display:grid;grid-template-columns:1fr 1fr;background:#dfe8ca;min-height:400px;padding:40px}h1{font:64px Georgia}button{border-radius:24px;transition:background .2s;background:linear-gradient(90deg,green,black);color:white;padding:20px}article{width:250px;height:200px;box-shadow:0 4px 12px #0003;border-radius:18px}</style></head><body><nav>Example <a>Work</a></nav><main><section><h1>A real design</h1><article>Card detail</article><button>Explore</button></section></main></body></html>';
test('extract rendered regions, styles, screenshots and preserve collections across captures',async()=>{
 const browser=await launch();let server;
 try{
  const source=await browser.newPage({viewport:{width:1365,height:900}});
  await source.setContent(fixture);
  const extracted=await source.evaluate(extractDesigns);
  await source.evaluate(()=>{const el=document.createElement('article');el.textContent='Offscreen carousel';el.style.cssText='position:absolute;left:1800px;top:100px;width:250px;height:200px';document.body.append(el)});
  const withOffscreen=await source.evaluate(extractDesigns);
  assert.ok(withOffscreen.fragments.every(f=>f.rect.x<1365&&f.rect.x+f.rect.width<=1365),'exclude horizontal offscreen carousel regions');
  assert.equal(extracted.title,'真实结构测试页');
  assert.ok(extracted.fragments.some(f=>f.type==='导航'));
  assert.ok(extracted.fragments.some(f=>f.type==='排版'&&f.style.fontSize==='64px'));
  assert.ok(extracted.fragments.every(f=>f.rect.width>0&&f.rect.y>=0));
  let batch=1000;
  async function payload(){const screenshot=await source.screenshot({type:'jpeg'});return {...extracted,source:'https://example.com',height:900,width:1365,screenshot:'data:image/jpeg;base64,'+screenshot.toString('base64'),method:'测试样本的真实 DOM 提取',fragments:await Promise.all(extracted.fragments.map(async(f,i)=>({...f,id:batch+i,capturedAt:'2026-10-29',source:'https://example.com',image:'data:image/jpeg;base64,'+(await source.screenshot({type:'jpeg',clip:f.rect})).toString('base64')})))}}
  const first=await payload();batch=2000;const second=await payload();
  first.fragments[0].name='<img src=x onerror=alert(1)>真实标题';
  first.fragments[0].image=''; // EdgeOne returns the full screenshot and crop rectangles.
  let calls=0;
  const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
  server=http.createServer((req,res)=>{if(req.url==='/api/analyze'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(calls++?second:first))}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.getByLabel('网页地址',{exact:true}).fill('https://example.com');
  await page.getByRole('button',{name:'开始拆解',exact:true}).click();
  await page.locator('.fragment').first().waitFor();
  assert.ok(await page.locator('.capture > img').count());
  assert.equal(await page.locator('.fragment h3 img').count(),0,'target text must not become markup');
  await page.getByRole('button',{name:'全选当前结果',exact:true}).click();
  await page.getByRole('button',{name:'收藏所选 ↗',exact:true}).click();
  await page.getByLabel('备注（可选）').fill('真实收藏测试');
  await page.getByRole('button',{name:'确认收藏',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/个人收藏库/}).click();
  assert.equal(await page.locator('.library-card').count(),first.fragments.length);
  await page.reload();await page.locator('.library-card').first().waitFor();
  assert.equal(await page.locator('.library-card').count(),first.fragments.length,'IndexedDB persists screenshots across reload');
  await page.getByRole('button',{name:'＋ 收集新灵感',exact:true}).click();
  await page.getByLabel('网页地址',{exact:true}).fill('https://another.example.com');
  await page.getByRole('button',{name:'开始拆解',exact:true}).click();
  await page.getByText('真实抓取完成，发现 '+second.fragments.length+' 个片段',{exact:true}).waitFor();
  await page.getByRole('button',{name:/个人收藏库/}).click();
  assert.equal(await page.locator('.library-card').count(),first.fragments.length,'new capture does not overwrite previous collection');
  await page.getByLabel('搜索收藏').fill('真实收藏测试');
  assert.equal(await page.locator('.library-card').count(),first.fragments.length);
  await page.getByRole('button',{name:'查看 / 编辑 ↗'}).first().click();
  await page.getByRole('dialog').waitFor();assert.equal(await page.getByLabel('我的备注').inputValue(),'真实收藏测试');
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await fs.mkdir(new URL('../output/playwright/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../output/playwright/library-desktop.png',import.meta.url).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile layout has no horizontal overflow');
  assert.deepEqual(errors,[]);
 }finally{if(server)await new Promise(r=>server.close(r));await browser.close()}
});
test('public proxy blocks direct loopback requests',async()=>{
 const proxy=await createPublicProxy();
 try{const response=await new Promise((resolve,reject)=>{http.get(proxy.server,{path:'http://127.0.0.1:80/'},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)});assert.equal(response,403)}
 finally{proxy.close()}
});


test('EdgeOne frontend preserves preview authentication on same-origin capture requests',async()=>{
 const browser=await launch();try{
  const page=await browser.newPage();
  const html=await fs.readFile(new URL('../edgeone-api/index.html',import.meta.url),'utf8');
  const requested=[];
  await page.route('https://designbreakdown-api-sxuxrgqg.edgeone.cool/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/api/analyze'){
    requested.push(u);await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'fixture capture reached'})});
   }else await route.fulfill({status:200,contentType:'text/html',body:html});
  });
  await page.goto('https://designbreakdown-api-sxuxrgqg.edgeone.cool/?eo_token=test-token&eo_time=123');
  await page.getByLabel('网页地址',{exact:true}).fill('https://example.com');
  await page.getByRole('button',{name:'开始拆解',exact:true}).click();
  await page.getByRole('status').filter({hasText:'fixture capture reached'}).waitFor();
  assert.equal(requested.length,1);
  assert.equal(requested[0].searchParams.get('eo_token'),'test-token');
  assert.equal(requested[0].searchParams.get('eo_time'),'123');
 }finally{await browser.close()}
});
