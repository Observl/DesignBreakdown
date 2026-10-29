// Runs inside the rendered target page. No target scripts or HTML are returned to our UI.
export function extractDesigns() {
  const viewport=innerWidth;
  const text=e=>(e.innerText||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,100);
  const candidates=[...document.querySelectorAll('header,nav,main>section,main>div,section,article,[role="navigation"],[role="banner"],footer,h1,h2,button,a')];
  const seen=new Set(),results=[];
  for(const el of candidates) {
    const box=el.getBoundingClientRect(),s=getComputedStyle(el);
    if(box.width<60||box.height<24||box.width>viewport+20||box.bottom<0||box.top+scrollY>14000||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)continue;
    const tag=el.tagName.toLowerCase(),label=text(el),size=parseFloat(s.fontSize);
    let type='',score=0,reasons=[],tags=[];
    const images=el.querySelectorAll('img,picture,video,svg').length;
    const gradient=/gradient/.test(s.backgroundImage),radius=parseFloat(s.borderRadius)||0,shadow=s.boxShadow!=='none',transform=s.transform!=='none';
    const animated=s.animationName!=='none',transition=s.transitionDuration.split(',').some(v=>parseFloat(v)>0);
    if(tag==='nav'||el.getAttribute('role')==='navigation'){type='导航';score=6;reasons.push('独立导航区域');tags.push('导航')}
    else if(tag==='h1'||tag==='h2'&&size>=28){type='排版';score=5+Math.min(size/25,4);reasons.push('字号 '+Math.round(size)+'px，字体 '+s.fontFamily.split(',')[0]);tags.push('大字体',s.fontWeight>=600?'粗字重':'轻字重')}
    else if(['button','a'].includes(tag)){if(box.width>350||box.height>140||!label||!((radius>8||gradient||shadow)&&transition||animated))continue;type='交互';score=4;reasons.push('检测到 '+(animated?'CSS 动画声明':'CSS 过渡声明')+'；需人工确认实际触发效果');tags.push('操作元素','样式声明')}
    else if(box.width>=viewport*.48&&box.height>=140){type='布局';score=4;reasons.push('大面积内容区块');if(['grid','flex'].includes(s.display)){score+=2;reasons.push(s.display==='grid'?'网格布局':'弹性布局');tags.push(s.display==='grid'?'网格':'弹性布局')}if(box.top+scrollY<900&&el.querySelector('h1')){score+=3;tags.push('首屏')}}
    else if((tag==='article'||images>0)&&box.width>=180&&box.height>=130&&box.height<=850){type='组件';score=4;reasons.push('独立内容单元');tags.push('内容卡片')}
    else continue;
    if(images){score+=Math.min(images,3);reasons.push('包含 '+images+' 个视觉元素');tags.push('图文')}
    if(gradient){score+=2;reasons.push('渐变背景');tags.push('渐变')}
    if(radius>12){score++;reasons.push('圆角 '+Math.round(radius)+'px');tags.push('圆角')}
    if(shadow){score++;reasons.push('使用阴影建立层次');tags.push('阴影')}
    if(transform||animated){score++;tags.push('变换 / 动画')}
    const key=[Math.round(box.x/12),Math.round((box.y+scrollY)/12),Math.round(box.width/12),Math.round(box.height/12)].join(':');
    if(seen.has(key))continue;seen.add(key);
    const heading=el.matches('h1,h2')?label:text(el.querySelector('h1,h2,h3')||el);
    results.push({name:(heading||({'导航':'网页导航','组件':'图文组件','布局':'内容布局','交互':'交互控件','排版':'标题排版'})[type]).slice(0,45),type,score,desc:reasons.slice(0,4).join('；')+'。',tags:[...new Set(tags)].slice(0,5),rect:{x:Math.max(0,Math.round(box.x)),y:Math.max(0,Math.round(box.y+scrollY)),width:Math.round(box.width),height:Math.min(Math.round(box.height),1200)},style:{font:s.fontFamily,fontSize:s.fontSize,color:s.color,background:s.backgroundColor,radius:s.borderRadius,display:s.display},text:label});
  }
  const picked=[];
  for(const c of results.sort((a,b)=>b.score-a.score)) {
    const duplicate=picked.some(p=>{
      if(p.type!==c.type)return false;
      const intersection=Math.max(0,Math.min(p.rect.x+p.rect.width,c.rect.x+c.rect.width)-Math.max(p.rect.x,c.rect.x))*Math.max(0,Math.min(p.rect.y+p.rect.height,c.rect.y+c.rect.height)-Math.max(p.rect.y,c.rect.y));
      return intersection/Math.min(p.rect.width*p.rect.height,c.rect.width*c.rect.height)>.8;
    });
    if(!duplicate)picked.push(c);
    if(picked.length>=16)break;
  }
  return {title:document.title,viewportWidth:viewport,pageHeight:Math.min(document.documentElement.scrollHeight,14000),fragments:picked.sort((a,b)=>a.rect.y-b.rect.y)};
}
