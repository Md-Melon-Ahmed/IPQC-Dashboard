// IPQC module — line-level & section roll-up entry
let ipqcEntries = loadLS(IPQC_KEY, []);      // line-level entries
let ipqcSectionEntries = loadLS(IQC_SECTION_KEY, []); // section roll-ups

const IPQC_DEFECTS = ["connection","circuit","scratch","spot","print","fitting","color","metal","nut","dirt"];

function ipqcMode(toggle) {
  const isLine = toggle === "line";
  $("ipqc-line-form-wrap").classList.toggle("hidden", !isLine);
  $("ipqc-section-form-wrap").classList.toggle("hidden", isLine);
  document.querySelectorAll("#ipqc-mode-toggle .btn-mode").forEach(b => b.classList.toggle("active", b.dataset.mode === toggle));
}

function ipqcCompute() {
  const checked = parseFloat($("ipqc-checked").value) || 0;
  const passed = parseFloat($("ipqc-passed").value) || 0;
  const failed = parseFloat($("ipqc-failed").value) || 0;
  let defectTotal = 0;
  document.querySelectorAll(".ipqc-defect").forEach(inp => { defectTotal += parseInt(inp.value) || 0; });
  $("ipqc-defect-total").textContent = defectTotal;
  const fpy = checked > 0 ? (passed / checked * 100) : 0;
  const failPct = checked > 0 ? (failed / checked * 100) : 0;
  const fpyEl = $("ipqc-fpy");
  fpyEl.textContent = checked > 0 ? fpy.toFixed(2) + "%" : "—";
  fpyEl.className = "calc-value " + (fpy >= 95 ? "pass" : (fpy >= 90 ? "" : "fail"));
  $("ipqc-failpct").textContent = checked > 0 ? failPct.toFixed(2) + "%" : "—";
}

function ipqcReset() {
  $("ipqc-form").reset();
  $("ipqc-date").value = todayStr();
  $("ipqc-repaired").value = 0;
  $("ipqc-failed").value = 0;
  document.querySelectorAll(".ipqc-defect").forEach(inp => inp.value = 0);
  ipqcCompute();
  $("ipqc-code").focus();
}

function renderIpqcTable() {
  const tbody = $("ipqc-tbody");
  tbody.innerHTML = "";
  const show = ipqcEntries.slice().reverse().slice(0, 50);
  if (!show.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--muted)">No IPQC line entries yet.</td></tr>';
    return;
  }
  show.forEach((e, i) => {
    const fpy = e.fpy != null ? e.fpy.toFixed(2) + "%" : "";
    const cls = (e.fpy != null && e.fpy >= 95) ? "pass" : "fail";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${ipqcEntries.length - i}</td><td>${fmtDate(e.date)}</td><td>${esc(e.section)}</td>
      <td>${esc(e.line)}</td><td>${esc(e.item||"")}</td><td>${e.checked||0}</td><td>${e.passed||0}</td>
      <td>${e.failed||0}</td><td>${e.defectTotal||0}</td>
      <td><span class="${cls}">${fpy}</span></td><td>${esc(e.remarks||"")}</td>`;
    tbody.appendChild(tr);
  });
}

async function ipqcSubmit(ev) {
  ev.preventDefault();
  const defects = {};
  document.querySelectorAll(".ipqc-defect").forEach(inp => { defects[inp.dataset.def] = parseInt(inp.value) || 0; });
  const checked = parseFloat($("ipqc-checked").value) || 0;
  const passed = parseFloat($("ipqc-passed").value) || 0;
  const failed = parseFloat($("ipqc-failed").value) || 0;
  const repaired = parseFloat($("ipqc-repaired").value) || 0;
  const defectTotal = Object.values(defects).reduce((a,b)=>a+b,0);
  const fpy = checked > 0 ? passed / checked * 100 : 0;
  const rec = {
    module: "ipqc",
    month: monthForDate($("ipqc-date").value),
    date: $("ipqc-date").value,
    section: $("ipqc-section").value,
    line: $("ipqc-line").value,
    hour: $("ipqc-hour").value.trim(),
    code: $("ipqc-code").value.trim(),
    item: $("ipqc-item").value.trim(),
    checked, passed, repaired, failed,
    defects, defectTotal,
    fpy: Math.round(fpy * 100) / 100,
    failPct: checked > 0 ? Math.round(failed/checked*10000)/100 : 0,
    remarks: $("ipqc-remarks").value.trim(),
    ts: new Date().toISOString()
  };
  if (!rec.date || !rec.code || !rec.item || checked <= 0 || passed < 0) {
    showToast("Please fill IPQC required fields.", "err");
    return;
  }
  ipqcEntries.push(rec);
  saveLS(IPQC_KEY, ipqcEntries);
  renderIpqcTable();

  const msg = $("ipqc-save-msg");
  const ep = localStorage.getItem(LS_IPQC_EP);
  if (ep) {
    try {
      msg.textContent = "Saving...";
      await postToEndpoint(ep, rec);
      msg.textContent = "Saved locally & sent ✓";
      msg.className = "save-msg ok";
      showToast("IPQC entry saved & sent to sheet", "ok");
    } catch (e) {
      msg.textContent = "Saved locally; Sheets failed.";
      msg.className = "save-msg err";
    }
  } else {
    msg.textContent = "Saved locally ✓";
    msg.className = "save-msg ok";
    showToast("IPQC entry saved locally", "ok");
  }
  ipqcReset();
}

function monthForDate(d) {
  if (!d) return "Sep-26";
  const p = d.split("-");
  const m = parseInt(p[1],10);
  const names = ["","Jan-26","Feb-26","Mar-26","Apr-26","May-26","June-26","July-26","Aug-26","Sep-26","Oct-26","Nov-26","Dec-26"];
  return names[m] || "Sep-26";
}

// Section roll-up
function ipqcSecCompute() {
  const checked = parseFloat($("ipqc-sec-checked").value) || 0;
  const passed = parseFloat($("ipqc-sec-passed").value) || 0;
  const fpy = checked > 0 ? passed/checked*100 : 0;
  const el = $("ipqc-sec-fpy");
  el.textContent = checked > 0 ? fpy.toFixed(2) + "%" : "—";
  el.className = "calc-value " + (fpy >= 95 ? "pass" : "fail");
}

async function ipqcSecSubmit(ev) {
  ev.preventDefault();
  const checked = parseFloat($("ipqc-sec-checked").value) || 0;
  const passed = parseFloat($("ipqc-sec-passed").value) || 0;
  if (checked <= 0) { showToast("Enter checked qty", "err"); return; }
  const fpy = Math.round(passed/checked*10000)/100;
  const rec = {
    module: "ipqc-section",
    month: $("ipqc-month").value,
    date: todayStr(),
    section: $("ipqc-sec-name").value,
    checked, passed,
    fpy,
    remarks: $("ipqc-sec-remarks").value.trim(),
    ts: new Date().toISOString()
  };
  ipqcSectionEntries.push(rec);
  saveLS(IQC_SECTION_KEY, ipqcSectionEntries);
  const msg = $("ipqc-sec-save-msg");
  const ep = localStorage.getItem(LS_IPQC_EP);
  if (ep) {
    try { await postToEndpoint(ep, rec); msg.textContent = "Saved & sent ✓"; msg.className = "save-msg ok"; }
    catch (e) { msg.textContent = "Saved locally"; msg.className = "save-msg ok"; }
  } else { msg.textContent = "Saved locally ✓"; msg.className = "save-msg ok"; }
  showToast("Section roll-up saved", "ok");
  $("ipqc-sec-checked").value = ""; $("ipqc-sec-passed").value = ""; $("ipqc-sec-remarks").value = "";
  ipqcSecCompute();
}

function initIPQC() {
  document.querySelectorAll("#ipqc-mode-toggle .btn-mode").forEach(b => {
    b.addEventListener("click", () => ipqcMode(b.dataset.mode));
  });
  ["ipqc-checked","ipqc-passed","ipqc-failed","ipqc-repaired"].forEach(id => $(id).addEventListener("input", ipqcCompute));
  document.querySelectorAll(".ipqc-defect").forEach(inp => inp.addEventListener("input", ipqcCompute));
  $("ipqc-form").addEventListener("submit", ipqcSubmit);
  $("ipqc-reset").addEventListener("click", ipqcReset);
  $("ipqc-section-form").addEventListener("submit", ipqcSecSubmit);
  ["ipqc-sec-checked","ipqc-sec-passed"].forEach(id => $(id).addEventListener("input", ipqcSecCompute));
  $("ipqc-load-recent").addEventListener("click", renderIpqcTable);
  $("ipqc-clear").addEventListener("click", () => {
    if (confirm("Clear all local IPQC entries?")) { ipqcEntries = []; saveLS(IPQC_KEY, []); renderIpqcTable(); }
  });
  ipqcReset();
  ipqcSecCompute();
  renderIpqcTable();
}
