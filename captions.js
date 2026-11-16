(()=>{const A=document.getElementById('audio'),btn=document.getElementById('capBtn'),L=document.getElementById('lyr'),box=document.getElementById('lyrBox'),P=document.getElementById('player');
let on=localStorage.getItem('capsOn')==='1',vid=null,lines=[],cur=-1,userScroll=0;
const idOf=()=>{const m=/\/(?:audio|a|s)\/([A-Za-z0-9_-]{11})/.exec(A.currentSrc||A.src||'');return m?m[1]:null};
const fit=()=>{const h=P&&!P.hidden?P.getBoundingClientRect().height:0;document.documentElement.style.setProperty('--lyr-bottom',Math.round(h)+'px')};
if(window.ResizeObserver&&P)new ResizeObserver(fit).observe(P);window.addEventListener('resize',fit);
async function load(){const v=idOf();if(!v||v===vid)return;vid=v;lines=[];cur=-1;box.innerHTML='<p class="lyr-msg">Loading captions…</p>';
 try{const r=await fetch('c/'+v+'.json');if(!r.ok)throw 0;lines=await r.json();}catch(e){box.innerHTML='<p class="lyr-msg">No captions for this shiur yet.</p>';return}
 if(v!==idOf())return;box.innerHTML='';lines.forEach((l,i)=>{const p=document.createElement('p');p.className='ln';p.textContent=l[1];p.onclick=()=>{A.currentTime=l[0];if(A.paused)A.play();userScroll=0;};box.appendChild(p)});
 box.scrollTop=0;tick(true);}
function center(el,smooth){const top=el.offsetTop-box.clientHeight/2+el.offsetHeight/2;box.scrollTo({top:Math.max(0,top),behavior:smooth?'smooth':'auto'})}
function tick(force){if(!on||L.hidden||!lines.length)return;const t=A.currentTime;let i=cur;if(i<0||!lines[i]||lines[i][0]>t)i=0;while(i+1<lines.length&&lines[i+1][0]<=t)i++;if(lines[0][0]>t)i=-1;
 if(i!==cur||force===true){const ps=box.children;if(cur>=0&&ps[cur])ps[cur].classList.remove('on');cur=i;if(i>=0&&ps[i]){ps[i].classList.add('on');if(Date.now()-userScroll>5000)center(ps[i],force!==true)}}}
function show(){const vis=on&&!!idOf()&&!(P&&P.hidden);btn.setAttribute('aria-pressed',String(on));btn.textContent=on?'Captions on':'Captions';L.hidden=!vis;document.body.classList.toggle('lyr-open',vis);
 if(vis){fit();document.getElementById('lyrT').textContent=document.getElementById('plT').textContent+' · Automatic captions';if(vid!==idOf())load();else tick(true)}}
function set(v){on=v;localStorage.setItem('capsOn',on?'1':'0');show()}
btn.addEventListener('click',e=>{e.stopPropagation();set(!on)});
const X=document.getElementById('lyrX');X.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();set(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&on)set(false)});
const mark=()=>userScroll=Date.now();['touchstart','touchmove','wheel','pointerdown'].forEach(ev=>box.addEventListener(ev,mark,{passive:true}));
A.addEventListener('timeupdate',()=>tick());A.addEventListener('loadedmetadata',show);A.addEventListener('play',show);A.addEventListener('seeked',()=>{cur=-1;tick()});
show();})();
