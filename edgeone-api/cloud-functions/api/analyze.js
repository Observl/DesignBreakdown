import {analyze} from '../../lib/analyzer.mjs';
let active=0;
const allowed=['https://observl.github.io','https://designbreakdown-api-sxuxrgqg.edgeone.cool'];
function reply(request,status,data){const origin=request.headers.get('origin');const same=origin===new URL(request.url).origin;return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...((same||allowed.includes(origin))?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}})}
export async function onRequest({request}){
const origin=request.headers.get('origin');
if(origin&&!allowed.includes(origin)&&origin!==new URL(request.url).origin)return reply(request,403,{error:'不允许此来源访问。'});
if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||allowed[0],'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}});
if(request.method!=='POST')return reply(request,405,{error:'请使用 POST 请求。'});
if(active)return reply(request,429,{error:'抓取服务正忙，请稍后重试。'});
active++;
try{if(Number(request.headers.get('content-length'))>4096)return reply(request,413,{error:'请求过长。'});const body=await request.text();if(body.length>4096)return reply(request,413,{error:'请求过长。'});let input;try{input=JSON.parse(body)}catch{return reply(request,400,{error:'JSON 格式错误。'})}return reply(request,200,await analyze(input.url))}
catch(error){console.error('Capture failed:',error.message);return reply(request,422,{error:error.message||'网页抓取失败。'})}
finally{active--}
}
