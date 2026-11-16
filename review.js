(()=>{const A=document.getElementById('audio'),box=document.getElementById('revBox');let shown=null;
let closed=localStorage.getItem('revClosed')==='1';
const esc=s=>String(s).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
const idOf=()=>{const m=/\/(?:audio|a|s)\/([A-Za-z0-9_-]{11})/.exec(A.currentSrc||A.src||'');return m?m[1]:null};
const played=id=>{try{return !!(JSON.parse(localStorage.getItem('ny.played')||'{}')[id])}catch(e){return false}};
function paint(body){box.innerHTML='<button type="button" class="rev-tg" aria-expanded="'+(!closed)+'"><span class="rev-h">Review</span><span class="rev-cv" aria-hidden="true"></span></button><div class="rev-b">'+body+'</div>';box.classList.toggle('closed',closed)}
box.addEventListener('click',e=>{const t=e.target.closest('.rev-tg');if(!t)return;e.stopPropagation();closed=!closed;localStorage.setItem('revClosed',closed?'1':'0');box.classList.toggle('closed',closed);t.setAttribute('aria-expanded',String(!closed))});
async function upd(){const id=idOf();if(!id){box.hidden=true;shown=null;return}
 box.hidden=false;
 if(!played(id)){if(shown!==id+'L'){shown=id+'L';paint('<p class="rev-lock">🔒 Unlocks when you finish this shiur.</p>')}return}
 if(shown===id)return;shown=id;paint('<p class="rev-lock">Loading…</p>');
 try{const r=await fetch('r/'+id+'.json');if(!r.ok)throw 0;const d=await r.json();if(shown!==id)return;
  paint('<ul>'+d.points.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul>')}
 catch(e){if(shown===id)paint('<p class="rev-lock">Review coming soon for this shiur.</p>')}}
A.addEventListener('loadedmetadata',upd);A.addEventListener('ended',()=>setTimeout(upd,300));document.addEventListener('click',()=>setTimeout(upd,200));setInterval(upd,3000);})();
