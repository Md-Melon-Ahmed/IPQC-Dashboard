// Analytics — aggregates local IQC + IPQC entries into FPY dashboard
let anCharts = {};

function refreshAnalytics() {
  // IPQC line entries by section
  const bySection = {};
  ipqcEntries.forEach(e => {
    const s = e.section || "Unknown";
    if (!bySection[s]) bySection[s] = { checked: 0, passed: 0, failed: 0, count: 0 };
    bySection[s].checked += e.checked || 0;
    bySection[s].passed += e.passed || 0;
    bySection[s].failed += e.failed || 0;
    bySection[s].count++;
  });
  // Also include section roll-ups merged into same sections
  ipqcSectionEntries.forEach(e => {
    const s = e.section || "Unknown";
    if (!bySection[s]) bySection[s] = { checked: 0, passed: 0, failed: 0, count: 0 };
    bySection[s].checked += e.checked || 0;
    bySection[s].passed += e.passed || 0;
    bySection[s].failed += (e.checked - e.passed) || 0;
    bySection[s].count++;
  });

  const sections = Object.keys(bySection).sort();
  const sectionFpy = sections.map(s => bySection[s].checked ? bySection[s].passed / bySection[s].checked * 100 : 0);

  // Overall IPQC fpy
  let totC = 0, totP = 0;
  Object.values(bySection).forEach(v => { totC += v.checked; totP += v.passed; });
  const overallFpy = totC > 0 ? (totP / totC * 100) : 0;
  $("an-fpy").textContent = totC > 0 ? overallFpy.toFixed(2) + "%" : "—";
  $("an-fpy").className = "stat-value " + (overallFpy >= 95 ? "green" : "red");
  $("an-count").textContent = ipqcEntries.length + ipqcSectionEntries.length;

  // IQC pass rate
  const iqc = iqcEntries;
  const iqcPassed = iqc.filter(e => e.result === "PASSED").length;
  $("an-iqcrate").textContent = iqc.length ? (iqcPassed / iqc.length * 100).toFixed(1) + "%" : "—";
  $("an-iqcrate").className = "stat-value " + (iqc.length && iqcPassed/iqc.length >= 0.95 ? "green" : "");

  // best section
  let best = null, bestFpy = -1;
  sections.forEach(s => { const f = bySection[s].checked ? bySection[s].passed/bySection[s].checked*100 : 0; if (f > bestFpy && bySection[s].checked > 0) { best = s; bestFpy = f; } });
  $("an-best").textContent = best ? best : "—";

  // Chart: section FPY
  if (anCharts.section) anCharts.section.destroy();
  const sc = document.getElementById("an-section-chart");
  if (sc) {
    anCharts.section = new Chart(sc, {
      type: "bar",
      data: { labels: sections, datasets: [{ label: "FPY %", data: sections.map(s => bySection[s].checked ? Math.round(bySection[s].passed/bySection[s].checked*10000)/100 : 0),
        backgroundColor: sections.map(s => { const f = bySection[s].checked ? bySection[s].passed/bySection[s].checked*100 : 0; return f >= 95 ? "#22c55e" : f >= 90 ? "#f59e0b" : "#ef4444"; }) }] },
      options: { responsive: true, plugins: { legend: { labels: { color: "#e2e8f0" } } },
        scales: { y: { min: 80, max: 100, ticks: { color: "#94a3b8", callback: v => v + "%" }, grid: { color: "#334155" } }, x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } } } }
    });
  }

  // Chart: by date (last 20 days of line entries)
  const dateMap = {};
  ipqcEntries.forEach(e => { const d = e.date || "?"; if (!dateMap[d]) dateMap[d] = { checked: 0, passed: 0 }; dateMap[d].checked += e.checked||0; dateMap[d].passed += e.passed||0; });
  const dates = Object.keys(dateMap).sort().slice(-20);
  if (anCharts.date) anCharts.date.destroy();
  const dc = document.getElementById("an-date-chart");
  if (dc) {
    anCharts.date = new Chart(dc, {
      type: "line",
      data: { labels: dates.map(fmtDate), datasets: [{ label: "FPY %", data: dates.map(d => dateMap[d].checked ? Math.round(dateMap[d].passed/dateMap[d].checked*10000)/100 : 0),
        borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,.15)", fill: true, tension: .3 }] },
      options: { responsive: true, plugins: { legend: { labels: { color: "#e2e8f0" } } },
        scales: { y: { min: 80, max: 100, ticks: { color: "#94a3b8", callback: v => v + "%" }, grid: { color: "#334155" } }, x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } } } }
    });
  }

  // Table
  const tbody = $("an-tbody");
  tbody.innerHTML = "";
  sections.forEach(s => {
    const v = bySection[s];
    const fpy = v.checked ? v.passed/v.checked*100 : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${esc(s)}</td><td>${v.checked.toLocaleString()}</td><td>${v.passed.toLocaleString()}</td>
      <td>${v.failed.toLocaleString()}</td><td><span class="${fpy>=95?'pass':'fail'}">${fpy.toFixed(2)}%</span></td><td>${v.count}</td>`;
    tbody.appendChild(tr);
  });
  if (!sections.length) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No IPQC entries yet.</td></tr>';
}
