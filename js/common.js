// Shared helpers & app shell
const IQC_KEY = "iqcEntriesV2";
const IPQC_KEY = "ipqcEntriesV2";
const IQC_SECTION_KEY = "ipqcSectionV2";
const LS_IQC_EP = "iqcEndpoint";
const LS_IPQC_EP = "ipqcEndpoint";

function $(id) { return document.getElementById(id); }

function loadLS(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; } }
function saveLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function todayStr() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }

function fmtDate(v) {
  if (!v) return "";
  const p = String(v).split("-");
  if (p.length !== 3) return v;
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return p[2] + "-" + (m[parseInt(p[1],10)-1]||p[1]) + "-" + p[0];
}

function esc(s) { return String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function showToast(msg, type) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast " + (type||"");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 4200);
}

async function postToEndpoint(url, payload) {
  const resp = await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  // no-cors -> opaque response; assume success (Apps Script logs errors in spreadsheet? no).
  return resp;
}

// Tabs
function bindTabs() {
  document.querySelectorAll("#module-tabs .tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#module-tabs .tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      $("tab-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "analytics") refreshAnalytics();
    });
  });
}

// Settings
function refreshConnStatus() {
  const el = $("conn-status");
  const iqc = !!localStorage.getItem(LS_IQC_EP);
  const ipqc = !!localStorage.getItem(LS_IPQC_EP);
  if (iqc && ipqc) { el.className = "conn-status all-on"; $("conn-text").textContent = "IQC + IPQC connected"; }
  else if (iqc || ipqc) { el.className = "conn-status iqc-on"; $("conn-text").textContent = iqc ? "IQC connected" : "IPQC connected"; }
  else { el.className = "conn-status"; $("conn-text").textContent = "Local only"; }
}

function bindSettings() {
  $("btn-settings").addEventListener("click", () => {
    $("set-iqc-endpoint").value = localStorage.getItem(LS_IQC_EP) || "";
    $("set-ipqc-endpoint").value = localStorage.getItem(LS_IPQC_EP) || "";
    $("settings-modal").classList.remove("hidden");
  });
  $("btn-close-settings").addEventListener("click", () => $("settings-modal").classList.add("hidden"));
  $("btn-save-settings").addEventListener("click", () => {
    localStorage.setItem(LS_IQC_EP, $("set-iqc-endpoint").value.trim());
    localStorage.setItem(LS_IPQC_EP, $("set-ipqc-endpoint").value.trim());
    refreshConnStatus();
    $("settings-modal").classList.add("hidden");
    showToast("Settings saved", "ok");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindTabs();
  bindSettings();
  initIQC();
  initIPQC();
  refreshConnStatus();
});
