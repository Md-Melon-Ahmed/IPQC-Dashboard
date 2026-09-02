/* QC Pulse — IQC + IPQC data entry & analytics (local-first, optional Apps Script sync) */
const IQC_KEY="iqcEntriesPulse", IPQC_KEY="ipqcEntriesPulse", SEC_KEY="ipqcSecPulse";
const LS_IQC_EP="iqcEp", LS_IPQC_EP="ipqcEp";
// IQC Master Data Apps Script Web App (bound to sheet 1hKodbuw1pAEzk91qiEw0WeqxY2byEuTZfKRgpqUFBNo)
const IQC_DEFAULT_EP="https://script.google.com/macros/s/AKfycbxyHoHZ6DG6rZLIgAgev5Nl0XbLO2Sx-IlZ68B-I7uhqS75cPBRpr0GBB2W7Opt1smz/exec";
const getIqcEp=()=>localStorage.getItem(LS_IQC_EP)||IQC_DEFAULT_EP;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const todayStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
function fmtDate(v){if(!v)return"";const p=String(v).split("-");if(p.length!==3)return v;
 const m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return p[2]+"-"+(m[parseInt(p[1],10)-1]||p[1])+"-"+p[0];}
function monthForDate(d){if(!d)return"Sep-26";const p=d.split("-");const n=["","Jan-26","Feb-26","Mar-26","Apr-26","May-26","June-26","July-26","Aug-26","Sep-26","Oct-26","Nov-26","Dec-26"];return n[parseInt(p[1],10)]||"Sep-26";}
function setToday(mod,which){if(mod==='iqc'){if(which==='rec')$("iqc-date-rec").value=todayStr();else $("iqc-date-ins").value=todayStr();}else{$("ipqc-date").value=todayStr();}}

let iqcEntries=load(IQC_KEY,[]), ipqcEntries=load(IPQC_KEY,[]), secEntries=load(SEC_KEY,[]);
let themeIdx=0, charts={}, activeDefectIdx=0;

const DEFECT_TYPES=["Connection Problem","Circuit Damage","Scratch","Spot","Improper Print","Extra Metal","Improper Fitting","Color Defect","Metal Parts Missing","Nut loose","Dirt/Uncleanness"];
const ODM_LIST=["Bhuiyan Poly Packs","Holopuls Techno","Joarder Printers","Metal Zone","Moon Corporation","Nezam Trading","Print Source","Priyanti Engineering","Royal Print Pack","SA EPS Insulation","Saadi Engineering","Taiji International","Unique Trade Corporation","United Packaging","Zara Printing & Packaging"];

/* ============ View routing ============ */
function hideAll(){["landing-view","chooser-view","iqc-app","ipqc-app","dashboard-app"].forEach(id=>$(id).classList.remove("active"));}
function showLanding(){hideAll();$("landing-view").classList.add("active");}
function openChooser(){hideAll();$("chooser-view").classList.add("active");}
function showEntry(which){hideAll();$(which+"-app").classList.add("active");renderHistory(which);}
function openDashboard(){hideAll();$("dashboard-app").classList.add("active");renderDashboard();}

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
 $("iqc-critical").value=0;$("iqc-major").value=0;$("iqc-minor").value=0;iqcCompute();}
async function iqcSubmit(e){e.preventDefault();
 const calc=iqcCompute();const rec={module:"iqc",month:$("iqc-month").value,lot:$("iqc-lot").value.trim(),
  dateRec:$("iqc-date-rec").value,dateIns:$("iqc-date-ins").value,odm:$("iqc-odm").value.trim(),code:$("iqc-code").value.trim(),
  desc:$("iqc-desc").value.trim(),lotSize:parseInt($("iqc-lotsize").value)||0,sample:parseInt($("iqc-sample").value)||0,
  status:$("iqc-status").value,critical:parseInt($("iqc-critical").value)||0,major:parseInt($("iqc-major").value)||0,
  minor:parseInt($("iqc-minor").value)||0,totalNG:calc.total,ngPct:calc.ng,result:calc.pass?"PASSED":"FAILED",
  failDesc:$("iqc-faildesc").value.trim(),picture:$("iqc-picture").value.trim(),remarks:$("iqc-remarks").value.trim(),
  ts:new Date().toISOString()};
 if(!rec.lot||!rec.dateRec||!rec.odm||!rec.code||!rec.desc||rec.lotSize<=0||rec.sample<=0){toast("Please fill all IQC required fields.","error");return;}
 iqcEntries.push(rec);save(IQC_KEY,iqcEntries);renderHistory("iqc");
 const msg=$("iqc-save-msg"),ep=getIqcEp();
 if(ep){try{await postEp(ep,rec);msg.textContent="Saved & synced to Google Sheet ✓";msg.className="save-msg ok";}
  catch(err){msg.textContent="Saved locally (sync pending)";msg.className="save-msg ok";}}
 else{msg.textContent="Saved locally ✓";msg.className="save-msg ok";}
 toast("IQC entry saved","success");iqcReset();}

/* ============ IPQC logic ============ */
function ipqcMode(mode){const line=mode==="line";$("ipqc-form").classList.toggle("hidden",!line);
 $("ipqc-section-form").classList.toggle("hidden",line);
 document.querySelectorAll("#ipqc-mode-toggle .pill").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));}
function addDefectRow(type){const rows=$("ipqc-defect-rows");const used=[];
 document.querySelectorAll(".defect-row select").forEach(s=>used.push(s.value));
 const avail=DEFECT_TYPES.filter(d=>!used.includes(d));const sel=type||avail[0]||DEFECT_TYPES[0];
 const row=document.createElement("div");row.className="defect-row";
 row.innerHTML=`<select><option value="">— select —</option>${DEFECT_TYPES.map(d=>`<option ${d===sel?"selected":""}>${d}</option>`).join("")}</select>
   <input type="number" min="0" value="0" placeholder="qty"><button type="button" class="rm" title="Remove">✕</button>`;
 row.querySelector("select").addEventListener("change",ipqcComputeDefects);
 row.querySelector("input").addEventListener("input",ipqcComputeDefects);
 row.querySelector(".rm").addEventListener("click",()=>{row.remove();ipqcComputeDefects();});
 rows.appendChild(row);ipqcComputeDefects();}
function ipqcComputeDefects(){let total=0;
 document.querySelectorAll("#ipqc-defect-rows .defect-row").forEach(r=>{const q=parseInt(r.querySelector("input").value)||0;total+=q;});
 $("ipqc-defect-total").textContent=total;$("ipqc-def-total2").textContent=total;
 const checked=parseFloat($("ipqc-checked").value)||0,passed=parseFloat($("ipqc-passed").value)||0,failed=parseFloat($("ipqc-failed").value)||0;
 const fpy=checked>0?passed/checked*100:0;const fp=$("ipqc-fpy");fp.textContent=checked>0?fpy.toFixed(2)+"%":"—";
 fp.className=fpy>=95?"pass":(fpy>=90?"":"fail");$("ipqc-failpct").textContent=checked>0?(failed/checked*100).toFixed(2)+"%":"—";}
function ipqcReset(){$("ipqc-form").reset();$("ipqc-date").value=todayStr();$("ipqc-repaired").value=0;$("ipqc-failed").value=0;
 $("ipqc-defect-rows").innerHTML="";addDefectRow();ipqcComputeDefects();}
async function ipqcSubmit(e){e.preventDefault();
 const defects=[];let defectTotal=0;
 document.querySelectorAll("#ipqc-defect-rows .defect-row").forEach(r=>{const ty=r.querySelector("select").value;const q=parseInt(r.querySelector("input").value)||0;
  if(ty&&q>0){defects.push({type:ty,qty:q});defectTotal+=q;}});
 const checked=parseFloat($("ipqc-checked").value)||0,passed=parseFloat($("ipqc-passed").value)||0,failed=parseFloat($("ipqc-failed").value)||0,repaired=parseFloat($("ipqc-repaired").value)||0;
 const fpy=checked>0?passed/checked*100:0;
 const rec={module:"ipqc",month:monthForDate($("ipqc-date").value),date:$("ipqc-date").value,section:$("ipqc-section").value,
  line:$("ipqc-line").value,hour:$("ipqc-hour").value.trim(),code:$("ipqc-code").value.trim(),item:$("ipqc-item").value.trim(),
  checked,passed,repaired,failed,defects,defectTotal,fpy:Math.round(fpy*100)/100,remarks:$("ipqc-remarks").value.trim(),ts:new Date().toISOString()};
 if(!rec.date||!rec.code||!rec.item||checked<=0){toast("Please fill IPQC required fields.","error");return;}
 ipqcEntries.push(rec);save(IPQC_KEY,ipqcEntries);renderHistory("ipqc");
 const msg=$("ipqc-save-msg"),ep=localStorage.getItem(LS_IPQC_EP);
 if(ep){try{await postEp(ep,rec);msg.textContent="Saved & synced ✓";msg.className="save-msg ok";}catch(err){msg.textContent="Saved locally ✓";msg.className="save-msg ok";}}
 else{msg.textContent="Saved locally ✓";msg.className="save-msg ok";}
 toast("IPQC entry saved","success");ipqcReset();}
function ipqcSecCompute(){const c=parseFloat($("ipqc-sec-checked").value)||0,p=parseFloat($("ipqc-sec-passed").value)||0;
 const f=c>0?p/c*100:0;const el=$("ipqc-sec-fpy");el.textContent=c>0?f.toFixed(2)+"%":"—";el.className=f>=95?"pass":"fail";}
async function ipqcSecSubmit(e){e.preventDefault();
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
   <td><span class="${e.result==="PASSED"?"pass":"fail"}">${e.result}</span></td>`;tb.appendChild(tr);});}
 else{const tb=$("ipqc-tbody");tb.innerHTML="";
  const rows=ipqcEntries.slice().reverse().slice(0,40);if(!rows.length){tb.innerHTML='<tr><td colspan="11" style="text-align:center;color:#94a3b8">No entries yet</td></tr>';return;}
  rows.forEach((e,i)=>{const tr=document.createElement("tr");const cls=(e.fpy!=null&&e.fpy>=95)?"pass":"fail";
   tr.innerHTML=`<td>${ipqcEntries.length-i}</td><td>${fmtDate(e.date)}</td><td>${esc(e.section)}</td><td>${esc(e.line)}</td>
    <td>${esc(e.item||"")}</td><td>${e.checked||0}</td><td>${e.passed||0}</td><td>${e.failed||0}</td><td>${e.defectTotal||0}</td>
    <td><span class="${cls}">${e.fpy!=null?e.fpy.toFixed(2)+"%":""}</span></td><td>${esc(e.remarks||"")}</td>`;tb.appendChild(tr);});}}

/* ============ Apps Script sync helper ============ */
async function postEp(url,payload){await fetch(url,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});}

/* ============ Dashboard ============ */
function isDark(){return document.documentElement.getAttribute("data-theme")==="dark";}
function axColor(){return isDark()?"#2dd4bf":"#0D5C58";}
function txtColor(){return isDark()?"#e2e8f0":"#374151";}
function destroyCharts(){Object.values(charts).forEach(c=>{try{c&&c.destroy();}catch(e){}});charts={};}
function rerenderCharts(){if($("dashboard-app").classList.contains("active"))renderDashboard();}
function switchDashTab(tab){document.querySelectorAll(".dash-tabbar .tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
 $("dash-iqc").classList.toggle("active",tab==="iqc");$("dash-ipqc").classList.toggle("active",tab==="ipqc");
 if(tab==="iqc"){destroyCharts();renderIQC();}else{destroyCharts();renderIPQC();}}

function renderDashboard(){document.querySelectorAll(".dash-tabbar .tab").forEach(b=>b.classList.toggle("active",b.dataset.tab==="iqc"));
 $("dash-iqc").classList.add("active");$("dash-ipqc").classList.remove("active");
 destroyCharts();renderIQC();}

function kpi(label,val,sub,color){return `<div class="kpi-card"><div class="kpi-label">${label}</div>
 <div class="kpi-value ${color||""}">${val}</div>${sub?`<div class="kpi-sub">${sub}</div>`:""}</div>`;}

function renderIQC(){const k=$("iqc-kpis");const total=iqcEntries.length;
 const passed=iqcEntries.filter(e=>e.result==="PASSED").length;
 const totalQty=iqcEntries.reduce((a,e)=>a+(parseInt(e.lotSize)||0),0);
 const totalNG=iqcEntries.reduce((a,e)=>a+(e.totalNG||0),0);
 const rate=total?passed/total*100:0;
 const rateColor=rate>=95?"ok":(rate>=85?"warn":"bad");
 k.innerHTML=kpi("Total Lots",total.toLocaleString(),"IQC entries",isDark()?"teal":"")+
  kpi("Passed",passed.toLocaleString(),(total-passed)+" failed","ok")+
  kpi("Pass Rate",total?rate.toFixed(1)+"%":"—",rate>=95?"Above target":"Below 95%",rateColor)+
  kpi("Total Qty",totalQty.toLocaleString(),"pcs inspected")+
  kpi("Total NG",totalNG.toLocaleString(),"defective parts","bad");
 // trend by date
 const byDate={};iqcEntries.forEach(e=>{const d=e.dateIns||"?";if(!byDate[d])byDate[d]={t:0,p:0};
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
 // matrix table
 const m=$("iqc-matrix");m.innerHTML="";
 const rows=iqcEntries.slice().reverse().slice(0,60);if(!rows.length){m.innerHTML='<tr><td colspan="9" style="text-align:center;color:#94a3b8">No IQC entries yet</td></tr>';return;}
 rows.forEach(e=>{const tr=document.createElement("tr");
  tr.innerHTML=`<td>${fmtDate(e.dateIns)}</td><td>${esc(e.lot)}</td><td>${esc(e.odm)}</td><td>${esc(e.desc)}</td>
   <td>${e.lotSize}</td><td>${e.sample}</td><td>${e.totalNG||0}</td><td>${e.ngPct!=null?(e.ngPct*100).toFixed(2)+"%":""}</td>
   <td><span class="${e.result==="PASSED"?"pass":"fail"}">${e.result}</span></td>`;m.appendChild(tr);});}

function renderIPQC(){const merged=ipqcEntries.slice();secEntries.forEach(s=>merged.push({section:s.section,checked:s.checked,passed:s.passed,date:s.date,line:"—",item:"Roll-up",failed:s.checked-s.passed}));
 const k=$("ipqc-kpis");const all=merged;
 const totC=all.reduce((a,e)=>a+(e.checked||0),0),totP=all.reduce((a,e)=>a+(e.passed||0),0);
 const totD=ipqcEntries.reduce((a,e)=>a+(e.defectTotal||0),0);
 const overall=totC?totP/totC*100:0;
 const secs={};all.forEach(e=>{const s=e.section||"?";if(!secs[s])secs[s]={c:0,p:0};
  secs[s].c+=e.checked||0;secs[s].p+=e.passed||0;});
 let best="—",bestF=-1;Object.keys(secs).forEach(s=>{const f=secs[s].c?secs[s].p/secs[s].c*100:0;if(f>bestF&&secs[s].c){best=s;bestF=f;}});
 const overallColor=overall>=95?"ok":(overall>=90?"warn":"bad");
 k.innerHTML=kpi("Overall FPY",totC?overall.toFixed(1)+"%":"—",totC.toLocaleString()+" checked",overallColor)+
  kpi("Total Defectives",totD.toLocaleString(),"from defect entries","bad")+
  kpi("Best Section",esc(best),bestF>=0?bestF.toFixed(1)+"% FPY":"","ok")+
  kpi("Entries",all.length.toLocaleString(),ipqcEntries.length+" line + "+secEntries.length+" rollup",isDark()?"teal":"");
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
 const byDate={};ipqcEntries.forEach(e=>{const d=e.date||"?";if(!byDate[d])byDate[d]={c:0,p:0};byDate[d].c+=e.checked||0;byDate[d].p+=e.passed||0;});
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
 const defs={};ipqcEntries.forEach(e=>(e.defects||[]).forEach(d=>{defs[d.type]=(defs[d.type]||0)+d.qty;}));
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
 const rowData=ipqcEntries.slice().reverse().slice(0,60);
 if(!rowData.length&&!secEntries.length){sc.innerHTML='<tr><td colspan="8" style="text-align:center;color:#94a3b8">No IPQC entries yet</td></tr>';return;}
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

/* ============ Init ============ */
function init(){
 $("iqc-date-rec").value=todayStr();$("iqc-date-ins").value=todayStr();$("ipqc-date").value=todayStr();
 ODM_LIST.forEach(o=>{const op=document.createElement("option");op.value=o;$("odm-list").appendChild(op);});
 ["iqc-sample","iqc-critical","iqc-major","iqc-minor"].forEach(id=>$(id).addEventListener("input",iqcCompute));
 $("iqc-form").addEventListener("submit",iqcSubmit);
 document.querySelectorAll("#ipqc-mode-toggle .pill").forEach(b=>b.addEventListener("click",()=>ipqcMode(b.dataset.mode)));
 ["ipqc-checked","ipqc-passed","ipqc-failed","ipqc-repaired"].forEach(id=>$(id).addEventListener("input",ipqcComputeDefects));
 $("ipqc-form").addEventListener("submit",ipqcSubmit);
 $("ipqc-section-form").addEventListener("submit",ipqcSecSubmit);
 ["ipqc-sec-checked","ipqc-sec-passed"].forEach(id=>$(id).addEventListener("input",ipqcSecCompute));
 document.querySelectorAll(".dash-tabbar .tab").forEach(b=>b.addEventListener("click",()=>switchDashTab(b.dataset.tab)));
 iqcReset();ipqcReset();ipqcSecCompute();addDefectRow();
 applyI18n();
}
document.addEventListener("DOMContentLoaded",()=>{init();showLanding();});
