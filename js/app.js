/* QC Pulse — IQC + IPQC data entry & analytics (local-first, optional Apps Script sync) */
const IQC_KEY="iqcEntriesPulse", OQC_KEY="oqcEntriesPulse", IPQC_KEY="ipqcEntriesPulse", SEC_KEY="ipqcSecPulse";
const LS_IQC_EP="iqcEp", LS_OQC_EP="oqcEp", LS_IPQC_EP="ipqcEp";
// QC Pulse backend (bound to "IQC-IPQC dashboard" spreadsheet: master data + IQC_data/IPQC_data)
const DATA_EP="https://script.google.com/macros/s/AKfycby6vu7ktKIG5EqjXVNGYaKpFXWI8Q9PRnzsxFCRZfkg36alJ6x0_AdLaNvRVSK8QBAeWA/exec";
const getIqcEp=()=>localStorage.getItem(LS_IQC_EP)||DATA_EP;
const getOqcEp=()=>localStorage.getItem(LS_OQC_EP)||DATA_EP;
const getIpqcEp=()=>localStorage.getItem(LS_IPQC_EP)||DATA_EP;
const getDataEp=()=>localStorage.getItem("dataEp")||DATA_EP;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const todayStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
function fmtDate(v){if(!v)return"";const p=String(v).split("-");if(p.length!==3)return v;
 const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return p[2]+"-"+(m[parseInt(p[1],10)-1]||p[1])+"-"+p[0];}
const MONTHS=["Jan","Feb","Mar","Apr","May","June","July","Aug","Sep","Oct","Nov","Dec"];
function monthLabel(dt){const d=dt instanceof Date?dt:new Date(String(dt).slice(0,10)+"T12:00:00");if(isNaN(d.getTime()))return monthLabel(new Date());return MONTHS[d.getMonth()]+"-"+String(d.getFullYear()).slice(2);}
function monthKey(l){const p=String(l||"").split("-");return (2000+parseInt(p[1],10))*12+Math.max(0,MONTHS.indexOf(p[0]));}
function monthForDate(d){return d?monthLabel(d):monthLabel(new Date());}
function yearOf(v){const d=new Date(String(v).slice(0,10)+"T12:00:00");return isNaN(d.getTime())?null:d.getFullYear();}
function buildMonthSet(){
  const now=new Date(),set={};
  let y0=now.getFullYear();
  [iqcEntries,oqcEntries].forEach(a=>a.forEach(e=>{const y=yearOf(e.dateIns);if(y)y0=Math.min(y0,y);}));
  [ipqcEntries,secEntries].forEach(a=>a.forEach(e=>{
    const y=yearOf(e.date);if(y)y0=Math.min(y0,y);
    if(e.month){const my=2000+parseInt(String(e.month).split("-")[1],10);if(!isNaN(my))y0=Math.min(y0,my);}
  }));
  const y1=now.getFullYear()+3;
  for(let y=y0;y<=y1;y++)for(let i=0;i<12;i++)set[monthLabel(new Date(y,i,1))]=1;
  return Object.keys(set).sort((a,b)=>monthKey(b)-monthKey(a));
}
function fillMonthSelects(){
  const list=buildMonthSet(),cur=monthLabel(new Date());
  ["iqc-month","oqc-month","ipqc-month"].forEach(id=>{const el=$(id);if(!el)return;const prev=el.value;
    el.innerHTML=list.map(m=>`<option>${m}</option>`).join("");
    el.value=(list.includes(prev)?prev:(list.includes(cur)?cur:list[0]))||"";});
  const dm=$("dash-month");
  if(dm){const prev=dm.value;    const dl=[];for(const y of [2026,2027])for(let i=0;i<12;i++)dl.push(monthLabel(new Date(y,i,1)));
    dl.sort((a,b)=>monthKey(b)-monthKey(a));
    dm.innerHTML='<option value="">All months</option>'+dl.map(m=>`<option>${m}</option>`).join("");if(dl.includes(prev))dm.value=prev;}
}
function strDate(v){return String(v==null?"":v).slice(0,10);}
function filterDash(list,dateKey){
  const has=dashMonth||dashFrom||dashTo;
  return (list||[]).filter(e=>{
    const d=strDate(e[dateKey]);
    if(!has) return true;
    if(!d) return false;
    if(dashFrom&&d<dashFrom) return false;
    if(dashTo&&d>dashTo) return false;
    if(dashMonth&&monthLabel(d)!==dashMonth) return false;
    return true;
  });
}
function clearDashFilters(){["dash-month","dash-date-from","dash-date-to"].forEach(id=>{const el=$(id);if(el)el.value="";});applyDashFilters();}
function applyDashFilters(){const m=$("dash-month"),f=$("dash-date-from"),t=$("dash-date-to");
  dashMonth=m?m.value:"";dashFrom=f?f.value:"";dashTo=t?t.value:"";
  const tab=document.querySelector(".dash-tabbar .tab.active");const tb=tab?tab.dataset.tab:"iqc";
  destroyCharts();if(tb==="ipqc")renderIPQC();else if(tb==="oqc")renderOQC();else renderIQC();}
function setToday(mod,which){if(mod==='iqc'||mod==='oqc'){if(which==='rec')$(mod+"-date-rec").value=todayStr();else $(mod+"-date-ins").value=todayStr();}else{$("ipqc-date").value=todayStr();}}
// Picture attach from gallery/camera: keep up to 4 images as a JSON array on the hidden field
function picList(which){try{const v=JSON.parse($(which+"-picture").value||"[]");return Array.isArray(v)?v:[];}catch(e){return []}}
function setPicList(which,list){$(which+"-picture").value=JSON.stringify(list);renderPreviews(which,list);}
function renderPreviews(which,list){
  const box=$(which+"-picture-previews");if(box)box.innerHTML="";
  list.forEach((u,i)=>{
    const w=document.createElement("div");w.className="pic-item";
    const im=document.createElement("img");im.className="pic-preview";im.src=u;im.onclick=()=>showPic(u);
    w.appendChild(im);
    const del=document.createElement("button");del.type="button";del.className="pic-del";del.title="Remove";del.textContent="✕";
    del.onclick=()=>removePic(which,i);
    w.appendChild(del);
    if(box)box.appendChild(w);
  });
  if(list.length>=4)toast("Maximum 4 pictures per entry","info");
}
function removePic(which,i){const l=picList(which);l.splice(i,1);setPicList(which,l);}
function compressDataUrl(dataUrl){return new Promise(resc=>compressImage(dataUrl,resc));}
function attachPic(which,input){
  const files=[...(input.files||[])];input.value="";
  if(!files.length)return;
  (async()=>{
    let list=picList(which);
    for(const f of files){
      if(list.length>=4)break;
      try{
        const dataUrl=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f);});
        const comp=await compressDataUrl(dataUrl);
        if(comp)list.push(comp);
      }catch(e){}
    }
    setPicList(which,list);
  })();
}
function clearPic(which){["-picture-input","-picture-cam"].forEach(s=>{const el=$(which+s);if(el)el.value="";});
  setPicList(which,[]);}
function compressImage(dataUrl,cb){
  const img=new Image();
  img.onload=()=>{
    const max=600;let s=Math.min(1,max/Math.max(img.width,img.height));
    let w=Math.max(180,Math.round(img.width*s)),h=Math.max(180,Math.round(img.height*s));
    const c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d");
    let out="";
    for(let q=0.85;q>=0.2;q-=0.05){
      ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
      out=c.toDataURL("image/jpeg",q);
      if(out.length<=45000)break;
      w=Math.max(120,Math.round(w*0.8));h=Math.max(120,Math.round(h*0.8));c.width=w;c.height=h;
    }
    cb(out);
  };
  img.src=dataUrl;
}
function showPic(src){const lb=$("lightbox");if(!lb)return;lb.src=src;lb.classList.remove("hidden");}
function picSrc(v){return v&&/^(data:image|https?:\/\/)/.test(String(v))?String(v):"";}
function showPicEntry(mod,i){const arr=mod==="iqc"?iqcEntries:oqcEntries;const e=arr[arr.length-1-i];if(e&&e.picture)showPic(e.picture);}

let iqcEntries=load(IQC_KEY,[]), oqcEntries=load(OQC_KEY,[]), ipqcEntries=load(IPQC_KEY,[]), secEntries=load(SEC_KEY,[]);
let themeIdx=0, charts={}, activeDefectIdx=0;
let dashMonth="", dashFrom="", dashTo="";

// Master data (from sheet)
let MASTER={items:[],materials:[],oqcMaterials:[],suppliers:[],defectTypes:[],aql:{codeToSize:{},ranges:[],ac:{}}};
let masterReady=false;
const DEFECT_TYPES=["Connection Problem","Circuit Damage","Scratch","Spot","Improper Print","Extra Metal","Improper Fitting","Color Defect","Metal Parts Missing","Nut loose","Dirt/Uncleanness"];
const ODM_LIST=["Bhuiyan Poly Packs","Holopuls Techno","Joarder Printers","Metal Zone","Moon Corporation","Nezam Trading","Print Source","Priyanti Engineering","Royal Print Pack","SA EPS Insulation","Saadi Engineering","Taiji International","Unique Trade Corporation","United Packaging","Zara Printing & Packaging"];

/* ============ Master data ============ */
function jsonp(url,timeoutMs){return new Promise((resolve,reject)=>{
  const cb="cb"+Math.random().toString(36).slice(2);
  const s=document.createElement("script");
  const t=setTimeout(()=>{cleanup();reject(new Error("timeout"))},timeoutMs||20000);
  function cleanup(){try{delete window[cb]}catch(e){} s.remove(); clearTimeout(t);}
  window[cb]=d=>{cleanup();resolve(d)};
  s.onerror=()=>{cleanup();reject(new Error("network"))};
  s.src=url+(url.indexOf("?")<0?"?":"&")+"callback="+cb+"&_="+Date.now();
  document.body.appendChild(s);
});}
async function apiGet(action){
  const url=getDataEp()+"?action="+action+"&_="+Date.now();
  try{
    const r=await fetch(url,{method:"GET",cache:"no-store"});
    if(r && r.ok) return await r.json();
  }catch(e){}
  return await jsonp(url);
}
async function loadMaster(){
  setMasterStatus("loading");
  try{
    const d=await apiGet("master");
    if(d && d.status==="ok" && (d.items||[]).length){
      MASTER={items:d.items||[],materials:d.materials||[],oqcMaterials:d.oqcMaterials||[],suppliers:d.suppliers||[],
        defectTypes:d.defectTypes||[],aql:d.aql||{codeToSize:{},ranges:[],ac:{}},auth:d.auth||null};
      masterReady=true;
      if(d.auth && authOk(d.auth)) cacheAuth(d.auth);
      try{ localStorage.setItem("masterCache", JSON.stringify(MASTER)); }catch(e){}
      populateAll(); setMasterStatus("ok");
      return;
    }
    throw new Error("empty");
  }catch(e){
    try{
      const c=localStorage.getItem("masterCache");
      if(c){ MASTER=JSON.parse(c); masterReady=true; populateAll(); setMasterStatus("cached"); return; }
    }catch(e2){}
    setMasterStatus("failed");
  }
}
function setMasterStatus(state){
  const els=[$("iqc-master-status"),$("ipqc-master-status")].filter(Boolean);
  els.forEach(el=>{
    if(state==="loading"){ el.className="master-status warn"; el.innerHTML="&#9203; Loading master data…"; }
    else if(state==="failed"){ el.className="master-status warn"; el.innerHTML='&#9888; Master data not loaded (check internet). You can still type ODM &amp; material manually. <button type="button" onclick="loadMaster()">Retry</button>'; }
    else { el.className="master-status hidden"; el.innerHTML=""; }
  });
}

/* ============ Authorization (restricted data entry) ============ */
const AUTH_KEY="qcAuthUser", AUTH_CACHE="authCache";
let AUTH={email:"",perms:{iqc:false,oqc:false,entry:false,dashboard:false,fpy:false}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function can(p){return !!AUTH.perms[p];}
function cacheAuth(a){try{localStorage.setItem(AUTH_CACHE,JSON.stringify(a));}catch(e){}}
function cachedAuth(){
  try{ const a=JSON.parse(localStorage.getItem(AUTH_CACHE)||"null"); if(a) return a; }catch(e){}
  try{ const c=JSON.parse(localStorage.getItem("masterCache")||"null"); if(c&&c.auth) return c.auth; }catch(e){}
  return null;
}
function authOk(a){return a && (a.iqc||a.entry||a.dashboard||a.fpy);}
async function fetchAuthLists(){
  if(MASTER && authOk(MASTER.auth)) return MASTER.auth;
  for(let i=0;i<2;i++){
    try{
      const d=await apiGet("auth");
      if(d && d.status==="ok" && authOk(d.auth)){ cacheAuth(d.auth); return d.auth; }
    }catch(e){}
    if(i<1) await sleep(800);
  }
  for(let i=0;i<12 && !masterReady;i++) await sleep(600);
  if(MASTER && authOk(MASTER.auth)) return MASTER.auth;
  return cachedAuth();
}
function permsFor(email, lists){
  const e=String(email||"").trim().toLowerCase();
  const has=k=>(lists&&lists[k]?lists[k]:[]).indexOf(e)>=0;
  const oqcList=(lists&&lists.oqc)?lists.oqc:[];
  const oqc=has("oqc") || (!oqcList.length && (has("iqc")||has("entry")));
  return { iqc:has("iqc"), oqc, entry:has("entry"), dashboard:has("dashboard"), fpy:has("fpy") };
}
function anyPerm(p){return p.iqc||p.oqc||p.entry||p.dashboard||p.fpy;}
async function submitAuth(){
  const email=$("auth-email").value.trim().toLowerCase();
  const msg=$("auth-msg"), btn=$("auth-btn"), retry=$("auth-retry"), req=$("auth-request");
  if(retry) retry.classList.add("hidden");
  if(req){ req.classList.add("hidden"); req.disabled=false; req.textContent="✉ Request access from admin"; }
  if(!email || email.indexOf("@")<0){ msg.className="auth-msg"; msg.textContent="Enter a valid email address."; return; }
  if(btn) btn.disabled=true;
  msg.className="auth-msg"; msg.textContent="Checking…";
  const lists=await fetchAuthLists();
  if(btn) btn.disabled=false;
  if(!lists){ msg.textContent="Cannot verify right now. Make sure you are online, then retry."; if(retry) retry.classList.remove("hidden"); return; }
  const perms=permsFor(email, lists);
  if(!anyPerm(perms)){ msg.textContent="This email is not authorized yet. Tap below to request access from the admin."; if(req) req.classList.remove("hidden"); return; }
  AUTH={email,perms};
  try{ localStorage.setItem(AUTH_KEY, JSON.stringify(AUTH)); }catch(e){}
  msg.className="auth-msg ok"; msg.textContent="Access granted ✓";
  hideAuthGate(); applyPermissions(); refreshUserChip();
  toast("Signed in as "+email,"success");
}
async function requestAccess(){
  const email=$("auth-email").value.trim().toLowerCase();
  const msg=$("auth-msg"), btn=$("auth-request");
  if(!email || email.indexOf("@")<0){ msg.className="auth-msg"; msg.textContent="Enter your email address first."; return; }
  if(btn){ btn.disabled=true; btn.textContent="Sending…"; }
  msg.className="auth-msg"; msg.textContent="Sending request to admin…";
  let info=""; try{ info=(navigator.userAgent||"").slice(0,180); }catch(e){}
  try{
    const r=await postEp(getDataEp(),{action:"access",email:email,info:info});
    if(r && r.status==="error") throw new Error(r.message||"error");
    msg.className="auth-msg ok"; msg.textContent="Request sent ✓ The admin will add your email, then you can sign in.";
    if(btn) btn.textContent="Request sent ✓";
  }catch(err){
    msg.className="auth-msg"; msg.textContent="Could not send the request. Check internet and try again.";
    if(btn){ btn.disabled=false; btn.textContent="✉ Request access from admin"; }
  }
}
function showAuthGate(){
  $("auth-gate").classList.remove("hidden");
  const e=$("auth-email"); if(e) e.value=AUTH.email||"";
  const m=$("auth-msg"); if(m){ m.className="auth-msg"; m.textContent=""; }
  const r=$("auth-retry"); if(r) r.classList.add("hidden");
  const q=$("auth-request"); if(q){ q.classList.add("hidden"); q.disabled=false; q.textContent="✉ Request access from admin"; }
}
function hideAuthGate(){ $("auth-gate").classList.add("hidden"); }
function signOut(){
  try{ localStorage.removeItem(AUTH_KEY); }catch(e){}
  AUTH={email:"",perms:{iqc:false,oqc:false,entry:false,dashboard:false,fpy:false}};
  applyPermissions(); refreshUserChip(); showLanding(); showAuthGate();
}
function applyPermissions(){
  const authed=!!AUTH.email;
  document.querySelectorAll("[data-perm]").forEach(el=>{
    const p=el.getAttribute("data-perm");
    const ok=p==="entry" ? (can("entry")||can("iqc")) : can(p);
    el.classList.toggle("hidden", authed && !ok);
  });
}
function refreshUserChip(){
  document.querySelectorAll(".user-chip").forEach(el=>{
    if(AUTH.email){ el.textContent="👤 "+AUTH.email+" ✕"; el.classList.remove("hidden"); }
    else { el.textContent=""; el.classList.add("hidden"); }
  });
}
async function bootstrapAuth(){
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(AUTH_KEY)||"null"); }catch(e){}
  if(saved && saved.email){
    const lists=await fetchAuthLists();
    if(lists){
      const perms=permsFor(saved.email, lists);
      if(anyPerm(perms)){ AUTH={email:saved.email,perms}; hideAuthGate(); applyPermissions(); refreshUserChip(); return; }
    } else {
      AUTH=saved; hideAuthGate(); applyPermissions(); refreshUserChip(); return;
    }
  }
  applyPermissions(); refreshUserChip(); showAuthGate();
  fetchAuthLists().catch(()=>{});   // warm the auth cache so Continue is instant
}

function populateAll(){ populateIQC(); populateOQC(); populateIPQC(); }

function fillOdmSelect(which){
  const dl=$(which+"-odm-list"); if(!dl) return;
  const list=MASTER.suppliers.length?MASTER.suppliers:ODM_LIST.map(n=>({code:"",name:n}));
  dl.innerHTML=list.map(s=>{const v=s.code||s.name;return `<option value="${esc(v)}">${esc(s.name)}</option>`;}).join("");
}
function odmInput(which){
  const el=$(which+"-odm-code"), nm=$(which+"-odm-name"); if(!el||!nm) return;
  const v=el.value.trim();
  if(!v){ nm.value=""; return; }
  const sups=MASTER.suppliers||[];
  const m=sups.find(s=>String(s.code)===v) || sups.find(s=>String(s.name).toLowerCase()===v.toLowerCase());
  if(m) nm.value=m.name;
}
function odmCommit(which){
  const el=$(which+"-odm-code"), nm=$(which+"-odm-name"); if(!el||!nm) return;
  const v=el.value.trim();
  if(!v){ nm.value=""; return; }
  const sups=MASTER.suppliers||[];
  let m=sups.find(s=>String(s.code)===v) || sups.find(s=>String(s.name).toLowerCase()===v.toLowerCase());
  if(!m){ const pref=sups.filter(s=>String(s.name).toLowerCase().indexOf(v.toLowerCase())===0); if(pref.length===1)m=pref[0]; }
  if(m){ el.value=String(m.code); nm.value=m.name; }
  else if(!sups.length){ nm.value=v; }
}

function populateOQC(){
  const code=$("oqc-code");
  if(!code) return;
  fillOdmSelect("oqc");
  const list=MASTER.oqcMaterials.length?MASTER.oqcMaterials:MASTER.materials;
  const mdl=$("oqc-material-list");
  if(mdl) mdl.innerHTML=list.map(m=>`<option value="${esc(m.code)}">${esc(m.desc)}</option>`).join("");
}
function oqcMat(code){
  const c=String(code||"").trim();
  return MASTER.oqcMaterials.find(x=>String(x.code)===c) || MASTER.materials.find(x=>String(x.code)===c);
}
function oqcMaterialChanged(){
  const m=oqcMat($("oqc-code").value);
  if(m){ $("oqc-desc").value=m.desc||""; $("oqc-pg").value=m.pg||""; $("oqc-cat").value=m.cat||""; $("oqc-level").value=m.level||"II"; }
  else { $("oqc-desc").value=""; $("oqc-pg").value=""; $("oqc-cat").value=""; $("oqc-level").value=""; }
  oqcAutoSample();
}
function oqcAutoSample(){
  const lot=parseInt($("oqc-lotsize").value)||0;
  const level=$("oqc-level").value||"II";
  if(!lot||!masterReady){return;}
  const r=(MASTER.aql.ranges||[]).find(x=>lot>=x.min && lot<=x.max);
  if(r){ const letter=r[level]||r["II"]; const size=(MASTER.aql.codeToSize||{})[letter]; if(size){ $("oqc-sample").value=size; oqcCompute(); } }
}

function populateIQC(){
  const code=$("iqc-code");
  if(!code) return;
  fillOdmSelect("iqc");
  const mdl=$("material-list");
  if(mdl) mdl.innerHTML=MASTER.materials.map(m=>`<option value="${esc(m.code)}">${esc(m.desc)}</option>`).join("");
}
function iqcMaterialChanged(){
  const c=$("iqc-code").value.trim();
  const m=MASTER.materials.find(x=>String(x.code)===String(c));
  if(m){ $("iqc-desc").value=m.desc||""; $("iqc-pg").value=m.pg||""; $("iqc-cat").value=m.cat||""; $("iqc-level").value=m.level||"II"; }
  else { $("iqc-desc").value=""; $("iqc-pg").value=""; $("iqc-cat").value=""; $("iqc-level").value=""; }
  iqcAutoSample();
}
function iqcAutoSample(){
  const lot=parseInt($("iqc-lotsize").value)||0;
  const level=$("iqc-level").value||"II";
  if(!lot||!masterReady){return;}
  const r=(MASTER.aql.ranges||[]).find(x=>lot>=x.min && lot<=x.max);
  if(r){ const letter=r[level]||r["II"]; const size=(MASTER.aql.codeToSize||{})[letter]; if(size){ $("iqc-sample").value=size; iqcCompute(); } }
}

const FALLBACK_SECTIONS=["Gang Switch Socket","Lighting","Switch Socket","HAP","PSS & Others","MCB","SDB","Exhaust Fan","PVC Tape"];
function fillDatalist(id, arr){
  const dl=$(id); if(!dl) return;
  dl.innerHTML=arr.map(x=>{
    if(x && typeof x==="object") return `<option value="${esc(x.v)}">${esc(x.t)}</option>`;
    return `<option value="${esc(x)}">`;
  }).join("");
}
function ipqcTimeList(){
  const pairs={};
  MASTER.items.forEach(i=>{ if(i.time && !(i.time in pairs)) pairs[i.time]=i.hour; });
  return Object.keys(pairs).sort((a,b)=>(Number(pairs[a])||99)-(Number(pairs[b])||99));
}
function populateIPQC(){
  const sec=$("ipqc-section"); if(!sec) return;
  let secs=[...new Set(MASTER.items.map(i=>i.section).filter(Boolean))].sort();
  if(!secs.length) secs=FALLBACK_SECTIONS;
  sec.innerHTML=secs.map(s=>`<option>${esc(s)}</option>`).join("");
  fillDatalist("ipqc-line-list", [...new Set(MASTER.items.map(i=>i.line).filter(Boolean))].sort());
  fillDatalist("ipqc-hour-list", ipqcTimeList());
  fillDatalist("ipqc-item-list", MASTER.items.map(i=>({v:i.code,t:i.code+" — "+i.name})));
  ipqcSectionChanged();
}
function ipqcSectionChanged(){
  const s=$("ipqc-section").value;
  const lines=[...new Set(MASTER.items.filter(i=>i.section===s).map(i=>i.line).filter(Boolean))].sort();
  fillDatalist("ipqc-line-list", lines);
  const items=MASTER.items.filter(i=>i.section===s);
  fillDatalist("ipqc-item-list", (items.length?items:MASTER.items).map(i=>({v:i.code,t:i.code+" — "+i.name})));
  $("ipqc-item").value="";
  renderDefectRows();
}
function ipqcLineChanged(){
  const s=$("ipqc-section").value, l=$("ipqc-line").value;
  const items=MASTER.items.filter(i=>i.section===s && i.line===l);
  fillDatalist("ipqc-item-list", (items.length?items:MASTER.items).map(i=>({v:i.code,t:i.code+" — "+i.name})));
  fillDatalist("ipqc-hour-list", ipqcTimeList());
}
function ipqcItemChanged(){
  const c=$("ipqc-code").value.trim();
  const it=MASTER.items.find(x=>String(x.code)===String(c));
  $("ipqc-item").value=it?it.name:"";
  renderDefectRows();
}
function currentDefectTypes(){
  // find item's defect group via item.defectCode -> group
  const c=$("ipqc-code")?$("ipqc-code").value:"";
  const it=MASTER.items.find(x=>String(x.code)===String(c));
  let group=null;
  if(it && it.defectCode){
    const dt=MASTER.defectTypes.find(d=>String(d.code)===String(it.defectCode));
    if(dt) group=dt.group;
  }
  let list=MASTER.defectTypes.filter(d=>d.active!==false);
  if(group){ const g=list.filter(d=>d.group===group); if(g.length) list=g; }
  return list.length? list.map(d=>d.problem) : DEFECT_TYPES;
}
function renderDefectRows(){
  const rows=$("ipqc-defect-rows"); if(!rows) return;
  rows.innerHTML=""; addDefectRow(); ipqcComputeDefects();
}

/* ============ View routing ============ */
function hideAll(){["landing-view","chooser-view","iqc-app","oqc-app","ipqc-app","dashboard-app"].forEach(id=>$(id).classList.remove("active"));}
function showLanding(){hideAll();$("landing-view").classList.add("active");}
function openChooser(){hideAll();$("chooser-view").classList.add("active");}
function showEntry(which){hideAll();$(which+"-app").classList.add("active");renderHistory(which);}
function openDashboard(){if(!can("dashboard")){toast("You are not authorized to view the dashboard.","error");return;}hideAll();$("dashboard-app").classList.add("active");renderDashboard();loadRecords();}
async function loadRecords(){
  try{
    const d=await apiGet("iqc");
    if(d&&d.rows){ iqcEntries=d.rows.map(r=>({lot:r[2],dateRec:r[3],dateIns:r[4],odm:r[6],code:r[7],desc:r[8],
      lotSize:parseInt(r[12])||0,sample:parseInt(r[13])||0,totalNG:parseInt(r[18])||0,result:r[19],ngPct:(parseFloat(r[20])||0)/100,picture:r[22]||""})); }
  }catch(e){}
  try{
    const d3=await apiGet("oqc");
    if(d3&&d3.rows){ oqcEntries=d3.rows.map(r=>({lot:r[2],dateRec:r[3],dateIns:r[4],odm:r[6],code:r[7],desc:r[8],
      lotSize:parseInt(r[12])||0,sample:parseInt(r[13])||0,totalNG:parseInt(r[18])||0,result:r[19],ngPct:(parseFloat(r[20])||0)/100,picture:r[22]||""})); }
  }catch(e){}
  try{
    const d2=await apiGet("ipqc");
    if(d2&&d2.rows){ ipqcEntries=d2.rows.map(r=>{ let defs=[]; try{defs=JSON.parse(r[16]||"[]")}catch(e){}
      return {date:r[2],section:r[3],line:r[4],hour:r[5],code:r[6],item:r[7],checked:parseFloat(r[10])||0,
        passed:parseFloat(r[11])||0,failed:parseFloat(r[13])||0,defectTotal:parseFloat(r[14])||0,fpy:parseFloat(r[15])||0,defects:defs}; }); }
  }catch(e){}
  if($("dashboard-app").classList.contains("active")){ destroyCharts(); const tab=document.querySelector(".dash-tabbar .tab.active"); const tb=tab?tab.dataset.tab:"iqc";
    if(tb==="ipqc") renderIPQC(); else if(tb==="oqc") renderOQC(); else renderIQC(); }
  fillMonthSelects();
}

/* ============ Theme / language ============ */
const THEMES=["","dark","sepia"], THEME_ICONS={light:"☀",dark:"🌙",sepia:"☕"};
function applyTheme(){const t=THEMES[themeIdx];document.documentElement.setAttribute("data-theme",t);
 document.querySelectorAll(".theme-icon").forEach(i=>i.textContent=THEME_ICONS[t||"light"]);rerenderCharts();}
function cycleTheme(){themeIdx=(themeIdx+1)%THEMES.length;applyTheme();}
let langIdx=0;
function cycleLang(){langIdx=1-langIdx;document.documentElement.lang=langIdx?"bn":"en";
 document.querySelectorAll(".lang-icon").forEach(i=>i.textContent=langIdx?"EN":"বাং");applyI18n();}
const I18N={en:{},bn:{
  tagline:"রিয়েল-টাইম কোয়ালিটি কন্ট্রোল টেলিমেট্রি ও অ্যানালিটিক্স",
  select_workspace:"ওয়ার্কস্পেস নির্বাচন করুন",choose_entry:"এন্ট্রি টাইপ নির্বাচন করুন",
  entry:"এন্ট্রি",entry_desc:"রিয়েল টাইমে IQC ও IPQC পরিদর্শন ডেটা রেকর্ড করুন",
  dashboard:"ড্যাশবোর্ড",dashboard_desc:"লাইভ QC অ্যানালিটিক্স: FPY, পাস রেট, ডিফেক্ট প্যারেটো",
  back_home:"হোমে ফিরুন",remarks:"মন্তব্য",optional:"ঐচ্ছিক",
  submit_entry:"এন্ট্রি জমা দিন",submit_defect:"ডিফেক্ট জমা দিন",ipqc_entry:"IPQC এন্ট্রি"}};
function t(key){const s=I18N[document.documentElement.lang==="bn"?"bn":"en"];return s[key]||I18N.en[key]||key;}
function applyI18n(){document.querySelectorAll("[data-i18n]").forEach(el=>{const k=el.getAttribute("data-i18n");const v=t(k);if(v!==k)el.textContent=v;});}

/* ============ Toast ============ */
function toast(msg,type){const c=$("toast-container");const d=document.createElement("div");d.className="toast "+(type||"");
 d.textContent=msg;c.appendChild(d);setTimeout(()=>d.remove(),4000);}

/* ============ IQC logic ============ */
function iqcCompute(){const sample=parseFloat($("iqc-sample").value)||0;
 const cr=parseInt($("iqc-critical").value)||0,ma=parseInt($("iqc-major").value)||0,mi=parseInt($("iqc-minor").value)||0;
 const total=cr+ma+mi;const ng=sample>0?total/sample:0;
 $("iqc-calc-ng").textContent=total;$("iqc-calc-ngpct").textContent=(ng*100).toFixed(2)+"%";
 const crP=sample>0?cr/sample:0,maP=sample>0?ma/sample:0,miP=sample>0?mi/sample:0;
 let pass=true;if(cr>0)pass=false;else if(maP>0.0065)pass=false;else if(miP>0.015)pass=false;
 const el=$("iqc-calc-result");el.textContent=pass?"PASSED":"FAILED";el.className=pass?"pass":"fail";
 return{total,ng,pass};}
function iqcReset(){$("iqc-form").reset();$("iqc-date-rec").value=todayStr();$("iqc-date-ins").value=todayStr();
 $("iqc-critical").value=0;$("iqc-major").value=0;$("iqc-minor").value=0;clearPic("iqc");iqcCompute();}
async function iqcSubmit(e){e.preventDefault();
 if(!can("iqc")){toast("You are not authorized to enter IQC data.","error");return;}
 const calc=iqcCompute();
 const lot=$("iqc-lot").value.trim(), dateRec=$("iqc-date-rec").value, dateIns=$("iqc-date-ins").value;
 const odmVal=$("iqc-odm-code").value.trim() || $("iqc-odm-name").value.trim();
 const sup=MASTER.suppliers.find(s=>String(s.code)===String(odmVal) || s.name===odmVal);
 const odmCode=sup?String(sup.code):(/^\d+$/.test(odmVal)?odmVal:"");
 const odmName=sup?sup.name:odmVal;
 const code=$("iqc-code").value.trim(), desc=$("iqc-desc").value.trim();
 const pg=$("iqc-pg").value, cat=$("iqc-cat").value, level=$("iqc-level").value;
 const lotSize=parseInt($("iqc-lotsize").value)||0, sample=parseInt($("iqc-sample").value)||0;
 const status=$("iqc-status").value, cr=parseInt($("iqc-critical").value)||0, ma=parseInt($("iqc-major").value)||0, mi=parseInt($("iqc-minor").value)||0;
 const failDesc=$("iqc-faildesc").value.trim(), pics=picList("iqc"), picture=pics[0]||"", remarks=$("iqc-remarks").value.trim();
 if(!lot||!dateRec||!odmVal||!code||lotSize<=0||sample<=0){toast("Please fill all IQC required fields.","error");return;}
 const rec={module:"iqc",lot,dateRec,dateIns,odmCode,odm:odmName,code,desc,pg,cat,level,lotSize,sample,status,critical:cr,major:ma,minor:mi,
totalNG:calc.total,ngPct:calc.ng,result:calc.pass?"PASSED":"FAILED",failDesc,picture,pictures:pics,remarks,ts:new Date().toISOString()};
 iqcEntries.push(rec);save(IQC_KEY,iqcEntries);renderHistory("iqc");
  const now=new Date().toLocaleString("en-GB");
const row=[now,AUTH.email,lot,dateRec,dateIns,odmCode,odmName,code,desc,pg,cat,level,lotSize,sample,status,cr,ma,mi,calc.total,
    calc.pass?"PASSED":"FAILED",(calc.ng*100).toFixed(2),failDesc,picture,remarks,pics[1]||"",pics[2]||"",pics[3]||""];
  const msg=$("iqc-save-msg");
 try{ const r=await postEp(getIqcEp(),{action:"iqc",email:AUTH.email,data:row});
   if(r && r.status==="error"){ msg.textContent="Not saved: "+(r.message||"server error");msg.className="save-msg err"; }
   else { msg.textContent="Saved & synced to sheet ✓";msg.className="save-msg ok"; } }
 catch(err){ msg.textContent="Saved locally (sync pending)";msg.className="save-msg ok"; }
 toast("IQC entry saved","success");iqcReset();}

/* ============ OQC logic (mirrors IQC, AQL from AQL_Tables) ============ */
function oqcCompute(){const sample=parseFloat($("oqc-sample").value)||0;
 const cr=parseInt($("oqc-critical").value)||0,ma=parseInt($("oqc-major").value)||0,mi=parseInt($("oqc-minor").value)||0;
 const total=cr+ma+mi;const ng=sample>0?total/sample:0;
 $("oqc-calc-ng").textContent=total;$("oqc-calc-ngpct").textContent=(ng*100).toFixed(2)+"%";
 const maP=sample>0?ma/sample:0,miP=sample>0?mi/sample:0;
 let pass=true;if(cr>0)pass=false;else if(maP>0.0065)pass=false;else if(miP>0.015)pass=false;
 const el=$("oqc-calc-result");el.textContent=pass?"PASSED":"FAILED";el.className=pass?"pass":"fail";
 return{total,ng,pass};}
function oqcReset(){$("oqc-form").reset();$("oqc-date-rec").value=todayStr();$("oqc-date-ins").value=todayStr();
 $("oqc-critical").value=0;$("oqc-major").value=0;$("oqc-minor").value=0;clearPic("oqc");oqcCompute();}
async function oqcSubmit(e){e.preventDefault();
 if(!can("oqc")){toast("You are not authorized to enter OQC data.","error");return;}
 const calc=oqcCompute();
 const lot=$("oqc-lot").value.trim(), dateRec=$("oqc-date-rec").value, dateIns=$("oqc-date-ins").value;
 const odmVal=$("oqc-odm-code").value.trim() || $("oqc-odm-name").value.trim();
 const sup=MASTER.suppliers.find(s=>String(s.code)===String(odmVal) || s.name===odmVal);
 const odmCode=sup?String(sup.code):(/^\d+$/.test(odmVal)?odmVal:"");
 const odmName=sup?sup.name:odmVal;
 const code=$("oqc-code").value.trim(), desc=$("oqc-desc").value.trim();
 const pg=$("oqc-pg").value, cat=$("oqc-cat").value, level=$("oqc-level").value;
 const lotSize=parseInt($("oqc-lotsize").value)||0, sample=parseInt($("oqc-sample").value)||0;
 const status=$("oqc-status").value, cr=parseInt($("oqc-critical").value)||0, ma=parseInt($("oqc-major").value)||0, mi=parseInt($("oqc-minor").value)||0;
 const failDesc=$("oqc-faildesc").value.trim(), pics=picList("oqc"), picture=pics[0]||"", remarks=$("oqc-remarks").value.trim();
 if(!lot||!dateRec||!odmVal||!code||lotSize<=0||sample<=0){toast("Please fill all OQC required fields.","error");return;}
 const rec={module:"oqc",lot,dateRec,dateIns,odmCode,odm:odmName,code,desc,pg,cat,level,lotSize,sample,status,critical:cr,major:ma,minor:mi,
totalNG:calc.total,ngPct:calc.ng,result:calc.pass?"PASSED":"FAILED",failDesc,picture,pictures:pics,remarks,ts:new Date().toISOString()};
 oqcEntries.push(rec);save(OQC_KEY,oqcEntries);renderHistory("oqc");
  const now=new Date().toLocaleString("en-GB");
const row=[now,AUTH.email,lot,dateRec,dateIns,odmCode,odmName,code,desc,pg,cat,level,lotSize,sample,status,cr,ma,mi,calc.total,
    calc.pass?"PASSED":"FAILED",(calc.ng*100).toFixed(2),failDesc,picture,remarks,pics[1]||"",pics[2]||"",pics[3]||""];
  const msg=$("oqc-save-msg");
 try{ const r=await postEp(getOqcEp(),{action:"oqc",email:AUTH.email,data:row});
   if(r && r.status==="error"){ msg.textContent="Not saved: "+(r.message||"server error");msg.className="save-msg err"; }
   else { msg.textContent="Saved & synced to sheet ✓";msg.className="save-msg ok"; } }
 catch(err){ msg.textContent="Saved locally (sync pending)";msg.className="save-msg ok"; }
 toast("OQC entry saved","success");oqcReset();}

/* ============ IPQC logic ============ */
function ipqcMode(mode){const line=mode==="line";$("ipqc-form").classList.toggle("hidden",!line);
 $("ipqc-section-form").classList.toggle("hidden",line);
 document.querySelectorAll("#ipqc-mode-toggle .pill").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));}
function addDefectRow(type){const rows=$("ipqc-defect-rows");const used=[];
 document.querySelectorAll(".defect-row select").forEach(s=>used.push(s.value));
 const types=currentDefectTypes();
 const avail=types.filter(d=>!used.includes(d));const sel=type||avail[0]||types[0];
 const row=document.createElement("div");row.className="defect-row";
 row.innerHTML=`<select><option value="">— select —</option>${types.map(d=>`<option ${d===sel?"selected":""}>${esc(d)}</option>`).join("")}</select>
   <input type="number" min="0" value="0" placeholder="qty"><button type="button" class="rm" title="Remove">✕</button>`;
 row.querySelector("select").addEventListener("change",ipqcComputeDefects);
 row.querySelector("input").addEventListener("input",ipqcComputeDefects);
 row.querySelector(".rm").addEventListener("click",()=>{row.remove();ipqcComputeDefects();});
 rows.appendChild(row);ipqcComputeDefects();}
function ipqcComputeDefects(){let total=0;
 document.querySelectorAll("#ipqc-defect-rows .defect-row").forEach(r=>{const q=parseInt(r.querySelector("input").value)||0;total+=q;});
 $("ipqc-defect-total").textContent=total;$("ipqc-def-total2").textContent=total;
 const checked=parseFloat($("ipqc-checked").value)||0,passed=parseFloat($("ipqc-passed").value)||0,failed=parseFloat($("ipqc-failed").value)||0;
 const fp=$("ipqc-fpy");
 if(checked>0){const fpy=passed/checked*100;fp.textContent=fpy.toFixed(2)+"%";fp.className=fpy>=95?"pass":(fpy>=90?"warn":"fail");}
 else{fp.textContent="—";fp.className="";}
 $("ipqc-failpct").textContent=checked>0?(failed/checked*100).toFixed(2)+"%":"—";}
function ipqcReset(){$("ipqc-form").reset();$("ipqc-date").value=todayStr();$("ipqc-repaired").value=0;$("ipqc-failed").value=0;
 $("ipqc-defect-rows").innerHTML="";addDefectRow();ipqcComputeDefects();}
async function ipqcSubmit(e){e.preventDefault();
 if(!can("entry")){toast("You are not authorized to enter IPQC data.","error");return;}
 const defects=[];let defectTotal=0;
 document.querySelectorAll("#ipqc-defect-rows .defect-row").forEach(r=>{const ty=r.querySelector("select").value;const q=parseInt(r.querySelector("input").value)||0;
  if(ty&&q>0){defects.push({type:ty,qty:q});defectTotal+=q;}});
 const checked=parseFloat($("ipqc-checked").value)||0,passed=parseFloat($("ipqc-passed").value)||0,failed=parseFloat($("ipqc-failed").value)||0,repaired=parseFloat($("ipqc-repaired").value)||0;
 const fpy=checked>0?passed/checked*100:0;
 const date=$("ipqc-date").value, section=$("ipqc-section").value, line=$("ipqc-line").value;
 const hourRaw=$("ipqc-hour").value.trim(), code=$("ipqc-code").value.trim(), item=$("ipqc-item").value;
 const it=MASTER.items.find(x=>String(x.code)===String(code));
 const pg=it?it.pg:"", target=it?it.target:"";
 const byTime=MASTER.items.find(x=>String(x.time)===hourRaw);
 const byHour=MASTER.items.find(x=>String(x.hour)===hourRaw);
 const hour=byTime?byTime.hour:(byHour?byHour.hour:hourRaw);
 const timeStr=byTime?String(byTime.time):((byHour&&byHour.time)?String(byHour.time):"");
 if(!date||!code||!item||checked<=0){toast("Please fill IPQC required fields.","error");return;}
 const rec={module:"ipqc",date,section,line,hour,time:timeStr,code,item,pg,checked,passed,repaired,failed,defects,defectTotal,
   fpy:Math.round(fpy*100)/100,remarks:$("ipqc-remarks").value.trim(),ts:new Date().toISOString()};
 ipqcEntries.push(rec);save(IPQC_KEY,ipqcEntries);renderHistory("ipqc");
 const now=new Date().toLocaleString("en-GB");
 const row=[now,AUTH.email,date,section,line,hour,timeStr,code,item,pg,target,checked,passed,repaired,failed,defectTotal,
   Math.round(fpy*100)/100,JSON.stringify(defects),$("ipqc-remarks").value.trim()];
 const msg=$("ipqc-save-msg");
 try{ const r=await postEp(getIpqcEp(),{action:"ipqc",email:AUTH.email,data:row});
   if(r && r.status==="error"){ msg.textContent="Not saved: "+(r.message||"server error");msg.className="save-msg err"; }
   else { msg.textContent="Saved & synced ✓";msg.className="save-msg ok"; } }
 catch(err){ msg.textContent="Saved locally ✓";msg.className="save-msg ok"; }
 toast("IPQC entry saved","success");ipqcReset();}
function ipqcSecCompute(){const c=parseFloat($("ipqc-sec-checked").value)||0,p=parseFloat($("ipqc-sec-passed").value)||0;
 const f=c>0?p/c*100:0;const el=$("ipqc-sec-fpy");el.textContent=c>0?f.toFixed(2)+"%":"—";el.className=f>=95?"pass":"fail";}
async function ipqcSecSubmit(e){e.preventDefault();
 if(!can("entry")){toast("You are not authorized to enter IPQC data.","error");return;}
 const c=parseFloat($("ipqc-sec-checked").value)||0,p=parseFloat($("ipqc-sec-passed").value)||0;
 if(c<=0){toast("Enter checked qty","error");return;}
 const rec={module:"ipqc-section",month:$("ipqc-month").value,date:todayStr(),section:$("ipqc-sec-name").value,
  checked:c,passed:p,fpy:Math.round(p/c*10000)/100,remarks:"",ts:new Date().toISOString()};
 secEntries.push(rec);save(SEC_KEY,secEntries);
 const msg=$("ipqc-sec-msg"),ep=localStorage.getItem(LS_IPQC_EP);
 msg.textContent=ep?"Saved & synced ✓":"Saved locally ✓";msg.className="save-msg ok";
 toast("Section roll-up saved","success");$("ipqc-sec-checked").value="";$("ipqc-sec-passed").value="";ipqcSecCompute();}
function clearIpqc(){if(confirm("Clear all local IPQC entries?")){ipqcEntries=[];save(IPQC_KEY,[]);renderHistory("ipqc");}}

/* ============ History render ============ */
function renderHistory(mod){if(mod==="iqc"){const tb=$("iqc-tbody");tb.innerHTML="";
 const rows=iqcEntries.slice().reverse().slice(0,40);if(!rows.length){tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:#94a3b8">No entries yet</td></tr>';return;}
 rows.forEach((e,i)=>{const tr=document.createElement("tr");
  tr.innerHTML=`<td>${iqcEntries.length-i}</td><td>${esc(e.lot)}</td><td>${fmtDate(e.dateIns)}</td><td>${esc(e.odm)}</td>
   <td>${esc(e.desc)}</td><td>${e.lotSize}</td><td>${e.sample}</td><td>${e.totalNG||0}</td><td>${(e.ngPct!=null?(e.ngPct*100).toFixed(2)+"%":"")}</td>
   <td><span class="${e.result==="PASSED"?"pass":"fail"}">${e.result}</span></td>
<td>${picSrc(e.picture)?`<div class="pic-cell"><img class="pic-thumb" src="${esc(picSrc(e.picture))}" alt="pic" onclick="showPicEntry('iqc',${i})">${(e.pictures&&e.pictures.length>1)?`<span class="pic-count">${e.pictures.length}</span>`:""}</div>`:"—"}</td>`;tb.appendChild(tr);});}
  else if(mod==="oqc"){const tb=$("oqc-tbody");tb.innerHTML="";
  const rows=oqcEntries.slice().reverse().slice(0,40);if(!rows.length){tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:#94a3b8">No entries yet</td></tr>';return;}
  rows.forEach((e,i)=>{const tr=document.createElement("tr");
tr.innerHTML=`<td>${oqcEntries.length-i}</td><td>${esc(e.lot)}</td><td>${fmtDate(e.dateIns)}</td><td>${esc(e.odm)}</td>
   <td>${esc(e.desc)}</td><td>${e.lotSize}</td><td>${e.sample}</td><td>${e.totalNG||0}</td><td>${(e.ngPct!=null?(e.ngPct*100).toFixed(2)+"%":"")}</td>
   <td><span class="${e.result==="PASSED"?"pass":"fail"}">${e.result}</span></td>
   <td>${picSrc(e.picture)?`<div class="pic-cell"><img class="pic-thumb" src="${esc(picSrc(e.picture))}" alt="pic" onclick="showPicEntry('oqc',${i})">${(e.pictures&&e.pictures.length>1)?`<span class="pic-count">${e.pictures.length}</span>`:""}</div>`:"—"}</td>`;tb.appendChild(tr);});}
 else{const tb=$("ipqc-tbody");tb.innerHTML="";
  const rows=ipqcEntries.slice().reverse().slice(0,40);if(!rows.length){tb.innerHTML='<tr><td colspan="12" style="text-align:center;color:#94a3b8">No entries yet</td></tr>';return;}
  rows.forEach((e,i)=>{const tr=document.createElement("tr");const cls=(e.fpy!=null&&e.fpy>=95)?"pass":"fail";
   tr.innerHTML=`<td>${ipqcEntries.length-i}</td><td>${fmtDate(e.date)}</td><td>${esc(e.section)}</td><td>${esc(e.line)}</td>
    <td>${esc(e.time||e.hour||"")}</td><td>${esc(e.item||"")}</td><td>${e.checked||0}</td><td>${e.passed||0}</td><td>${e.failed||0}</td><td>${e.defectTotal||0}</td>
    <td><span class="${cls}">${e.fpy!=null?e.fpy.toFixed(2)+"%":""}</span></td><td>${esc(e.remarks||"")}</td>`;tb.appendChild(tr);});}}

/* ============ Apps Script sync helper ============ */
async function postEp(url,payload){
  try{
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
    if(r && r.type!=="opaque"){
      try{ return await r.json(); }catch(e){ return {status:"ok"}; }
    }
  }catch(e){}
  await fetch(url,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
  return {status:"ok"};
}

/* ============ Dashboard ============ */
function isDark(){return document.documentElement.getAttribute("data-theme")==="dark";}
function axColor(){return isDark()?"#2dd4bf":"#0D5C58";}
function txtColor(){return isDark()?"#e2e8f0":"#374151";}
function destroyCharts(){Object.values(charts).forEach(c=>{try{c&&c.destroy();}catch(e){}});charts={};}
function rerenderCharts(){if($("dashboard-app").classList.contains("active"))renderDashboard();}
function switchDashTab(tab){document.querySelectorAll(".dash-tabbar .tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
 $("dash-iqc").classList.toggle("active",tab==="iqc");$("dash-oqc").classList.toggle("active",tab==="oqc");$("dash-ipqc").classList.toggle("active",tab==="ipqc");
 destroyCharts();if(tab==="iqc")renderIQC();else if(tab==="oqc")renderOQC();else renderIPQC();}

function renderDashboard(){document.querySelectorAll(".dash-tabbar .tab").forEach(b=>b.classList.toggle("active",b.dataset.tab==="iqc"));
 $("dash-iqc").classList.add("active");$("dash-oqc").classList.remove("active");$("dash-ipqc").classList.remove("active");
 destroyCharts();renderIQC();}

function kpi(label,val,sub,color){return `<div class="kpi-card"><div class="kpi-label">${label}</div>
 <div class="kpi-value ${color||""}">${val}</div>${sub?`<div class="kpi-sub">${sub}</div>`:""}</div>`;}

function renderIQC(){const k=$("iqc-kpis");const E=filterDash(iqcEntries,"dateIns");const total=E.length;
 const passed=E.filter(e=>e.result==="PASSED").length;
 const totalQty=E.reduce((a,e)=>a+(parseInt(e.lotSize)||0),0);
 const totalNG=E.reduce((a,e)=>a+(e.totalNG||0),0);
 const rate=total?passed/total*100:0;
 const defRate=totalQty?totalNG/totalQty*100:0;
 const rateColor=rate>=95?"ok":(rate>=85?"warn":"bad");
 k.innerHTML=kpi("Total Lots",total.toLocaleString(),"IQC entries",isDark()?"teal":"")+
  kpi("Passed",passed.toLocaleString(),(total-passed)+" failed","ok")+
  kpi("Pass Rate",total?rate.toFixed(1)+"%":"—",rate>=95?"Above target":"Below 95%",rateColor)+
  kpi("Received Qty",totalQty.toLocaleString(),"pcs received")+
  kpi("Failed Qty",totalNG.toLocaleString(),"defective parts","bad")+
  kpi("Defect Rate",totalQty?defRate.toFixed(2)+"%":"—","Failed / Received");
 // trend by date
 const byDate={};E.forEach(e=>{const d=strDate(e.dateIns)||"?";if(!byDate[d])byDate[d]={t:0,p:0};
  byDate[d].t++;byDate[d].p+=e.result==="PASSED"?1:0;});
 const dates=Object.keys(byDate).sort().slice(-14);
 const trendOpt={chart:{type:"area",height:260,fontFamily:"Inter",toolbar:{show:false},animations:{enabled:false}},
  series:[{name:"Pass Rate %",data:dates.map(d=>byDate[d].t?Math.round(byDate[d].p/byDate[d].t*1000)/10:0)}],
  colors:[axColor()],stroke:{curve:"smooth",width:3},
  fill:{type:"gradient",gradient:{opacityFrom:.35,opacityTo:.05}},
  xaxis:{categories:dates.map(fmtDate),labels:{style:{colors:txtColor()}}},
  yaxis:{min:0,max:100,labels:{style:{colors:"#6B7280"},formatter:v=>v+"%"}},
  grid:{borderColor:isDark()?"#334155":"#e2e8f0"},
  dataLabels:{enabled:false},
  annotations:{yaxis:[{y:95,borderColor:"#10B981",strokeDashArray:4,label:{text:"Target 95%",style:{background:"#10B981",color:"#fff",fontSize:"10px"}}}]},
  tooltip:{theme:isDark()?"dark":"light"}};
 if(charts.iqcTrend)charts.iqcTrend.destroy();
 charts.iqcTrend=new ApexCharts($("chart-iqc-trend"),trendOpt);charts.iqcTrend.render();
 // donut pass/fail
 const passC=passed,failC=total-passed;
 const donutOpt={chart:{type:"donut",height:260,animations:{enabled:false}},
  series:[passC,failC],labels:["Passed","Failed"],
  colors:["#10B981","#EF4444"],
  legend:{position:"bottom",labels:{colors:txtColor()},fontSize:"12px"},
  dataLabels:{enabled:true,formatter:(v,o)=>o.w.globals.series[o.seriesIndex]},
  plotOptions:{pie:{donut:{size:"70%"}}},
  tooltip:{theme:isDark()?"dark":"light"}};
 charts.iqcDonut=new ApexCharts($("chart-iqc-donut"),donutOpt);charts.iqcDonut.render();
 // bar: failed % by ODM (failed qty / received qty)
 const byOdm={};E.forEach(e=>{const o=(e.odm||"—").trim()||"—";
  if(!byOdm[o])byOdm[o]={ng:0,qty:0};
  byOdm[o].ng+=e.totalNG||0;byOdm[o].qty+=parseInt(e.lotSize)||0;});
 const odmArr=Object.entries(byOdm).map(([o,v])=>[o,v.qty?v.ng/v.qty*100:0,v.ng,v.qty]).sort((a,b)=>b[1]-a[1]).slice(0,16);
 const odmOpt={chart:{type:"bar",height:300,fontFamily:"Inter",toolbar:{show:false},animations:{enabled:false}},
  series:[{name:"Failed %",data:odmArr.map(x=>Math.round(x[1]*100)/100)}],colors:["#EF4444"],
  plotOptions:{bar:{borderRadius:4,columnWidth:"55%"}},
  xaxis:{categories:odmArr.map(x=>x[0].length>16?x[0].slice(0,15)+"…":x[0]),
   labels:{rotate:-45,rotateAlways:true,style:{colors:txtColor(),fontSize:"9px"}}},
  yaxis:{labels:{style:{colors:"#6B7280"},formatter:v=>v+"%"},title:{text:"Failed %",style:{color:txtColor()}}},
  dataLabels:{enabled:true,formatter:v=>Math.round(v*100)/100+"%",style:{fontSize:"10px",colors:["#374151"]}},
  grid:{borderColor:isDark()?"#334155":"#e2e8f0"},legend:{show:false},
  tooltip:{theme:isDark()?"dark":"light",y:{formatter:(v,o)=>{const d=odmArr[o.dataPointIndex];return v+"%  ("+(d?d[2]:0)+" failed / "+(d?d[3]:0)+" received pcs)";}}}};
 if(charts.iqcOdm)charts.iqcOdm.destroy();
 charts.iqcOdm=new ApexCharts($("chart-iqc-odm"),odmOpt);charts.iqcOdm.render();
 // matrix table
 const m=$("iqc-matrix");m.innerHTML="";
 const rows=E.slice().reverse().slice(0,60);if(!rows.length){m.innerHTML='<tr><td colspan="9" style="text-align:center;color:#94a3b8">No IQC entries yet</td></tr>';return;}
 rows.forEach(e=>{const tr=document.createElement("tr");
  tr.innerHTML=`<td>${fmtDate(e.dateIns)}</td><td>${esc(e.lot)}</td><td>${esc(e.odm)}</td><td>${esc(e.desc)}</td>
   <td>${e.lotSize}</td><td>${e.sample}</td><td>${e.totalNG||0}</td><td>${e.ngPct!=null?(e.ngPct*100).toFixed(2)+"%":""}</td>
   <td><span class="${e.result==="PASSED"?"pass":"fail"}">${e.result}</span></td>`;m.appendChild(tr);});}

function renderOQC(){const k=$("oqc-kpis");const E=filterDash(oqcEntries,"dateIns");const total=E.length;
 const passed=E.filter(e=>e.result==="PASSED").length;
 const totalQty=E.reduce((a,e)=>a+(parseInt(e.lotSize)||0),0);
 const totalNG=E.reduce((a,e)=>a+(e.totalNG||0),0);
 const rate=total?passed/total*100:0;
 const defRate=totalQty?totalNG/totalQty*100:0;
 const rateColor=rate>=95?"ok":(rate>=85?"warn":"bad");
 k.innerHTML=kpi("Total Lots",total.toLocaleString(),"OQC entries",isDark()?"teal":"")+
  kpi("Passed",passed.toLocaleString(),(total-passed)+" failed","ok")+
  kpi("Pass Rate",total?rate.toFixed(1)+"%":"—",rate>=95?"Above target":"Below 95%",rateColor)+
  kpi("Received Qty",totalQty.toLocaleString(),"pcs received")+
  kpi("Failed Qty",totalNG.toLocaleString(),"defective parts","bad")+
  kpi("Defect Rate",totalQty?defRate.toFixed(2)+"%":"—","Failed / Received");
 const byDate={};E.forEach(e=>{const d=strDate(e.dateIns)||"?";if(!byDate[d])byDate[d]={t:0,p:0};
  byDate[d].t++;byDate[d].p+=e.result==="PASSED"?1:0;});
 const dates=Object.keys(byDate).sort().slice(-14);
 const trendOpt={chart:{type:"area",height:260,fontFamily:"Inter",toolbar:{show:false},animations:{enabled:false}},
  series:[{name:"Pass Rate %",data:dates.map(d=>byDate[d].t?Math.round(byDate[d].p/byDate[d].t*1000)/10:0)}],
  colors:["#b45309"],stroke:{curve:"smooth",width:3},
  fill:{type:"gradient",gradient:{opacityFrom:.35,opacityTo:.05}},
  xaxis:{categories:dates.map(fmtDate),labels:{style:{colors:txtColor()}}},
  yaxis:{min:0,max:100,labels:{style:{colors:"#6B7280"},formatter:v=>v+"%"}},
  grid:{borderColor:isDark()?"#334155":"#e2e8f0"},
  dataLabels:{enabled:false},
  annotations:{yaxis:[{y:95,borderColor:"#10B981",strokeDashArray:4,label:{text:"Target 95%",style:{background:"#10B981",color:"#fff",fontSize:"10px"}}}]},
  tooltip:{theme:isDark()?"dark":"light"}};
 if(charts.oqcTrend)charts.oqcTrend.destroy();
 charts.oqcTrend=new ApexCharts($("chart-oqc-trend"),trendOpt);charts.oqcTrend.render();
 const passC=passed,failC=total-passed;
 const donutOpt={chart:{type:"donut",height:260,animations:{enabled:false}},
  series:[passC,failC],labels:["Passed","Failed"],
  colors:["#10B981","#EF4444"],
  legend:{position:"bottom",labels:{colors:txtColor()},fontSize:"12px"},
  dataLabels:{enabled:true,formatter:(v,o)=>o.w.globals.series[o.seriesIndex]},
  plotOptions:{pie:{donut:{size:"70%"}}},
  tooltip:{theme:isDark()?"dark":"light"}};
 if(charts.oqcDonut)charts.oqcDonut.destroy();
 charts.oqcDonut=new ApexCharts($("chart-oqc-donut"),donutOpt);charts.oqcDonut.render();
 const m=$("oqc-matrix");m.innerHTML="";
 const rows=E.slice().reverse().slice(0,60);if(!rows.length){m.innerHTML='<tr><td colspan="9" style="text-align:center;color:#94a3b8">No OQC entries yet</td></tr>';return;}
 rows.forEach(e=>{const tr=document.createElement("tr");
  tr.innerHTML=`<td>${fmtDate(e.dateIns)}</td><td>${esc(e.lot)}</td><td>${esc(e.odm)}</td><td>${esc(e.desc)}</td>
   <td>${e.lotSize}</td><td>${e.sample}</td><td>${e.totalNG||0}</td><td>${e.ngPct!=null?(e.ngPct*100).toFixed(2)+"%":""}</td>
   <td><span class="${e.result==="PASSED"?"pass":"fail"}">${e.result}</span></td>`;m.appendChild(tr);});}

function renderIPQC(){const LINE=filterDash(ipqcEntries,"date"),SEC=filterDash(secEntries,"date");
 const merged=LINE.slice();SEC.forEach(s=>merged.push({section:s.section,checked:s.checked,passed:s.passed,date:s.date,line:"—",item:"Roll-up",failed:s.checked-s.passed}));
 const k=$("ipqc-kpis");const all=merged;
 const totC=all.reduce((a,e)=>a+(e.checked||0),0),totP=all.reduce((a,e)=>a+(e.passed||0),0);
 const totD=LINE.reduce((a,e)=>a+(e.defectTotal||0),0);
 const totFail=totC-totP;
 const overall=totC?totP/totC*100:0;
 const defRate=totC?totFail/totC*100:0;
 const secs={};all.forEach(e=>{const s=e.section||"?";if(!secs[s])secs[s]={c:0,p:0};
  secs[s].c+=e.checked||0;secs[s].p+=e.passed||0;});
 let best="—",bestF=-1;Object.keys(secs).forEach(s=>{const f=secs[s].c?secs[s].p/secs[s].c*100:0;if(f>bestF&&secs[s].c){best=s;bestF=f;}});
 const overallColor=overall>=95?"ok":(overall>=90?"warn":"bad");
 k.innerHTML=kpi("Overall FPY",totC?overall.toFixed(1)+"%":"—",totC.toLocaleString()+" checked",overallColor)+
  kpi("Checked Qty",totC.toLocaleString(),"pcs checked")+
  kpi("Failed Qty",totFail.toLocaleString(),"defective parts","bad")+
  kpi("Defect Rate",totC?defRate.toFixed(2)+"%":"—","Failed / Checked")+
  kpi("Total Defectives",totD.toLocaleString(),"from defect entries","bad")+
  kpi("Best Section",esc(best),bestF>=0?bestF.toFixed(1)+"% FPY":"","ok")+
  kpi("Entries",all.length.toLocaleString(),LINE.length+" line + "+SEC.length+" rollup",isDark()?"teal":"");
 // by section bar
 const names=Object.keys(secs).sort();const vals=names.map(s=>secs[s].c?Math.round(secs[s].p/secs[s].c*1000)/10:0);
 const colors=vals.map(v=>v>=95?"#10B981":v>=90?"#F59E0B":"#EF4444");
 const secOpt={chart:{type:"bar",height:260,fontFamily:"Inter",toolbar:{show:false},animations:{enabled:false}},
  series:[{name:"FPY %",data:vals}],colors:["#0D5C58"],
  plotOptions:{bar:{borderRadius:4,columnWidth:"55%",distributed:true}},
  xaxis:{categories:names.map(n=>n.length>10?n.slice(0,9)+"…":n),labels:{style:{colors:txtColor(),fontSize:"10px"}}},
  yaxis:{min:80,max:100,labels:{style:{colors:"#6B7280"},formatter:v=>v+"%"}},
  dataLabels:{enabled:false},
  annotations:{yaxis:[{y:95,borderColor:"#10B981",strokeDashArray:4,label:{text:"Target",style:{background:"#10B981",color:"#fff",fontSize:"10px"}}}]},
  grid:{borderColor:isDark()?"#334155":"#e2e8f0"},
  legend:{show:false},tooltip:{theme:isDark()?"dark":"light",y:{formatter:v=>v+"%"}},
  colors:colors};
 charts.sec=new ApexCharts($("chart-sec"),secOpt);charts.sec.render();
 // by date line
 const byDate={};LINE.forEach(e=>{const d=strDate(e.date)||"?";if(!byDate[d])byDate[d]={c:0,p:0};byDate[d].c+=e.checked||0;byDate[d].p+=e.passed||0;});
 const dates=Object.keys(byDate).sort().slice(-20);
 const dateOpt={chart:{type:"line",height:260,fontFamily:"Inter",toolbar:{show:false},animations:{enabled:false}},
  series:[{name:"FPY %",data:dates.map(d=>byDate[d].c?Math.round(byDate[d].p/byDate[d].c*1000)/10:0)}],
  colors:[axColor()],stroke:{curve:"smooth",width:3},
  xaxis:{categories:dates.map(fmtDate),labels:{style:{colors:txtColor(),fontSize:"10px"}}},
  yaxis:{min:80,max:100,labels:{style:{colors:"#6B7280"},formatter:v=>v+"%"}},
  grid:{borderColor:isDark()?"#334155":"#e2e8f0"},
  dataLabels:{enabled:false},tooltip:{theme:isDark()?"dark":"light"},
  annotations:{yaxis:[{y:95,borderColor:"#10B981",strokeDashArray:4,label:{text:"Target",style:{background:"#10B981",color:"#fff"}}}]}};
 charts.date=new ApexCharts($("chart-date"),dateOpt);charts.date.render();
 // defect pareto
 const defs={};LINE.forEach(e=>(e.defects||[]).forEach(d=>{defs[d.type]=(defs[d.type]||0)+d.qty;}));
 const dl=Object.entries(defs).sort((a,b)=>b[1]-a[1]);const dTot=dl.reduce((a,x)=>a+x[1],0);
 const paretoNames=dl.map(x=>x[0].length>14?x[0].slice(0,13)+"…":x[0]);
 let cum=0;const cumArr=dl.map(x=>{cum+=x[1];return dTot?Math.round(cum/dTot*100):0;});
 const paretoOpt={chart:{type:"bar",height:260,fontFamily:"Inter",toolbar:{show:false},animations:{enabled:false}},
  series:[{name:"Defectives",type:"bar",data:dl.map(x=>x[1])},
   {name:"Cumulative %",type:"line",data:cumArr}],
  colors:["#EF4444",axColor()],
  stroke:{width:[0,3],curve:"smooth"},
  xaxis:{categories:paretoNames,labels:{style:{colors:txtColor(),fontSize:"9px"},rotate:-35}},
  yaxis:[{labels:{style:{colors:"#6B7280"},formatter:v=>v.toLocaleString()}},
   {opposite:true,min:0,max:100,labels:{style:{colors:"#6B7280"},formatter:v=>v+"%"}}],
  legend:{show:false},dataLabels:{enabled:false},
  grid:{borderColor:isDark()?"#334155":"#e2e8f0"},tooltip:{theme:isDark()?"dark":"light"}};
 charts.pareto=new ApexCharts($("chart-pareto"),paretoOpt);charts.pareto.render();
 // volume donut
 const volNames=names.map(n=>n.length>12?n.slice(0,11)+"…":n);
 const volOpt={chart:{type:"donut",height:260,animations:{enabled:false}},
  series:names.map(s=>secs[s].c),labels:volNames,
  colors:["#0D5C58","#13827d","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#10b981","#64748b"],
  legend:{position:"bottom",labels:{colors:txtColor()},fontSize:"10px"},
  dataLabels:{enabled:false},plotOptions:{pie:{donut:{size:"70%"}}},
  tooltip:{theme:isDark()?"dark":"light",y:{formatter:v=>v.toLocaleString()+" pcs"}}};
 charts.vol=new ApexCharts($("chart-vol"),volOpt);charts.vol.render();
 // scorecard
 const sc=$("ipqc-scorecard");sc.innerHTML="";
 const rowData=LINE.slice().reverse().slice(0,60);
 if(!rowData.length&&!SEC.length){sc.innerHTML='<tr><td colspan="8" style="text-align:center;color:#94a3b8">No IPQC entries yet</td></tr>';return;}
 rowData.forEach(e=>{const f=e.fpy!=null?e.fpy:0;const status=f>=95?"Good":f>=90?"OK":"Poor";
  const sc2=status==="Good"?"pass":status==="OK"?"warn":"fail";
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>${esc(e.section)}</td><td>${esc(e.line)}</td><td>${esc(e.item||"")}</td><td>${e.checked}</td>
   <td>${e.passed}</td><td>${e.defectTotal||0}</td><td>${f?f.toFixed(1)+"%":""}</td>
   <td><span class="${sc2}">${status}</span></td>`;sc.appendChild(tr);});}

/* ============ CSV export ============ */
function downloadCSV(name,rows){const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${String(c==null?"":c).replace(/"/g,'""')}"`).join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=name;a.click();}
function exportIQCCSV(){downloadCSV("IQC_Matrix.csv",[["Date","LOT","ODM","Material","Lot","Sample","NG","NG%","Result"]]
 .concat(iqcEntries.map(e=>[fmtDate(e.dateIns),e.lot,e.odm,e.desc,e.lotSize,e.sample,e.totalNG||0,(e.ngPct!=null?(e.ngPct*100).toFixed(2)+"%":""),e.result])));}
function exportIPQCCSV(){downloadCSV("IPQC_Quality.csv",[["Section","Line","Item","Checked","Passed","Defects","FPY%"]]
 .concat(ipqcEntries.map(e=>[e.section,e.line,e.item,e.checked,e.passed,e.defectTotal||0,e.fpy!=null?e.fpy.toFixed(1):""])));}
function exportOQCCSV(){downloadCSV("OQC_Matrix.csv",[["Date","LOT","ODM","Material","Lot","Sample","NG","NG%","Result"]]
 .concat(oqcEntries.map(e=>[fmtDate(e.dateIns),e.lot,e.odm,e.desc,e.lotSize,e.sample,e.totalNG||0,(e.ngPct!=null?(e.ngPct*100).toFixed(2)+"%":""),e.result])));}

/* ============ Init ============ */
function init(){
 $("iqc-date-rec").value=todayStr();$("iqc-date-ins").value=todayStr();$("ipqc-date").value=todayStr();
 ["iqc-sample","iqc-critical","iqc-major","iqc-minor"].forEach(id=>$(id).addEventListener("input",iqcCompute));
 $("iqc-code").addEventListener("change",iqcMaterialChanged);
 $("iqc-code").addEventListener("input",iqcMaterialChanged);
  $("iqc-lotsize").addEventListener("input",iqcAutoSample);
  $("iqc-odm-code").addEventListener("input",()=>odmInput("iqc"));
  $("iqc-odm-code").addEventListener("change",()=>odmCommit("iqc"));
  $("iqc-form").addEventListener("submit",iqcSubmit);
 $("oqc-date-rec").value=todayStr();$("oqc-date-ins").value=todayStr();
 ["oqc-sample","oqc-critical","oqc-major","oqc-minor"].forEach(id=>$(id).addEventListener("input",oqcCompute));
 $("oqc-code").addEventListener("change",oqcMaterialChanged);
 $("oqc-code").addEventListener("input",oqcMaterialChanged);
  $("oqc-lotsize").addEventListener("input",oqcAutoSample);
  $("oqc-odm-code").addEventListener("input",()=>odmInput("oqc"));
  $("oqc-odm-code").addEventListener("change",()=>odmCommit("oqc"));
  $("oqc-form").addEventListener("submit",oqcSubmit);
 document.querySelectorAll("#ipqc-mode-toggle .pill").forEach(b=>b.addEventListener("click",()=>ipqcMode(b.dataset.mode)));
 $("ipqc-section").addEventListener("change",ipqcSectionChanged);
 $("ipqc-line").addEventListener("change",ipqcLineChanged);
 $("ipqc-code").addEventListener("change",ipqcItemChanged);
 $("ipqc-code").addEventListener("input",ipqcItemChanged);
 ["ipqc-checked","ipqc-passed","ipqc-failed","ipqc-repaired"].forEach(id=>$(id).addEventListener("input",ipqcComputeDefects));
 $("ipqc-form").addEventListener("submit",ipqcSubmit);
 $("ipqc-section-form").addEventListener("submit",ipqcSecSubmit);
 ["ipqc-sec-checked","ipqc-sec-passed"].forEach(id=>$(id).addEventListener("input",ipqcSecCompute));
 document.querySelectorAll(".dash-tabbar .tab").forEach(b=>b.addEventListener("click",()=>switchDashTab(b.dataset.tab)));
iqcReset();oqcReset();ipqcReset();ipqcSecCompute();addDefectRow();
  fillMonthSelects();
  applyI18n();
 loadMaster();
 bootstrapAuth();
 $("auth-email").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submitAuth();}});
}
document.addEventListener("DOMContentLoaded",()=>{init();showLanding();});
