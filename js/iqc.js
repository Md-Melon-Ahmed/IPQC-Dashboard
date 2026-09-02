// IQC module — incoming material inspection entry
let iqcEntries = loadLS(IQC_KEY, []);
const IQC_ODMS = [
  "Bhuiyan Poly Packs","Holopuls Techno","Joarder Printers","Metal Zone","Moon Corporation",
  "Nezam Trading","Print Source","Priyanti Engineering","Royal Print Pack","SA EPS Insulation",
  "Saadi Engineering","Taiji International","Unique Trade Corporation","United Packaging",
  "Zara Printing & Packaging"
];

function iqcCompute() {
  const sample = parseFloat($("iqc-sample").value) || 0;
  const critical = parseInt($("iqc-critical").value) || 0;
  const major = parseInt($("iqc-major").value) || 0;
  const minor = parseInt($("iqc-minor").value) || 0;
  const totalNG = critical + major + minor;
  const ngPct = sample > 0 ? totalNG / sample : 0;
  $("iqc-calc-ng").textContent = totalNG;
  $("iqc-calc-ngpct").textContent = (ngPct * 100).toFixed(2) + "%";
  const crPct = sample > 0 ? critical / sample : 0;
  const maPct = sample > 0 ? major / sample : 0;
  const miPct = sample > 0 ? minor / sample : 0;
  let passed = true;
  if (critical > 0 || crPct > 0) passed = false;
  else if (maPct > 0.0065) passed = false;
  else if (miPct > 0.015) passed = false;
  const res = $("iqc-calc-result");
  res.textContent = passed ? "PASSED" : "FAILED";
  res.className = "calc-value " + (passed ? "pass" : "fail");
  return { totalNG, ngPct, passed };
}

function iqcSaveLocalAndRender() {
  saveLS(IQC_KEY, iqcEntries);
  updateIqcTable();
}

function updateIqcTable() {
  const tbody = $("iqc-tbody") || document.createElement("tbody");
  // IQC recent table is inside analytics? For IQC tab we keep a compact table? We show analytics table later.
  // We'll store for analytics; show count via toast on submit. Not a dedicated iqc table in this layout.
}

function iqcReset() {
  $("iqc-form").reset();
  $("iqc-date-rec").value = todayStr();
  $("iqc-date-ins").value = todayStr();
  $("iqc-critical").value = 0;
  $("iqc-major").value = 0;
  $("iqc-minor").value = 0;
  iqcCompute();
  $("iqc-lot").focus();
}

async function iqcSubmit(ev) {
  ev.preventDefault();
  const rec = {
    month: $("iqc-month").value,
    lot: $("iqc-lot").value.trim(),
    dateRec: $("iqc-date-rec").value,
    dateIns: $("iqc-date-ins").value,
    odm: $("iqc-odm").value.trim(),
    code: $("iqc-code").value.trim(),
    desc: $("iqc-desc").value.trim(),
    lotSize: parseInt($("iqc-lotsize").value) || 0,
    sample: parseInt($("iqc-sample").value) || 0,
    status: $("iqc-status").value,
    critical: parseInt($("iqc-critical").value) || 0,
    major: parseInt($("iqc-major").value) || 0,
    minor: parseInt($("iqc-minor").value) || 0,
    failDesc: $("iqc-faildesc").value.trim(),
    picture: $("iqc-picture").value.trim(),
    remarks: $("iqc-remarks").value.trim(),
    ts: new Date().toISOString(),
    module: "iqc"
  };
  const calc = iqcCompute();
  rec.totalNG = calc.totalNG;
  rec.ngPct = calc.ngPct;
  rec.result = calc.passed ? "PASSED" : "FAILED";
  if (!rec.lot || !rec.dateRec || !rec.odm || !rec.code || !rec.desc || rec.lotSize <= 0 || rec.sample <= 0) {
    showToast("Please fill all IQC required fields.", "err");
    return;
  }
  iqcEntries.push(rec);
  iqcSaveLocalAndRender();

  const msg = $("iqc-save-msg");
  const ep = localStorage.getItem(LS_IQC_EP);
  if (ep) {
    try {
      msg.textContent = "Saving...";
      await postToEndpoint(ep, rec);
      msg.textContent = "Saved locally & sent to IQC sheet ✓";
      msg.className = "save-msg ok";
      showToast("IQC entry saved & sent to Google Sheet", "ok");
    } catch (e) {
      msg.textContent = "Saved locally; Sheets send failed.";
      msg.className = "save-msg err";
      showToast("IQC saved locally. Sheets failed - check Settings.", "err");
    }
  } else {
    msg.textContent = "Saved locally ✓ (link Google Sheets in Settings)";
    msg.className = "save-msg ok";
    showToast("IQC entry saved locally", "ok");
  }
  iqcReset();
}

function initIQC() {
  const dl = $("iqc-odm-list");
  IQC_ODMS.forEach(o => { const op = document.createElement("option"); op.value = o; dl.appendChild(op); });
  ["iqc-sample","iqc-critical","iqc-major","iqc-minor"].forEach(id => {
    $(id).addEventListener("input", iqcCompute);
  });
  $("iqc-form").addEventListener("submit", iqcSubmit);
  $("iqc-reset").addEventListener("click", iqcReset);
  iqcReset();
}
