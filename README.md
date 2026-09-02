# QC Pulse — IQC & IPQC Dashboard

A quality-control dashboard for **Akij Light Engineering Ltd.** redesigned in the style of **ALEL Pulse** — glassmorphism UI, teal brand theme (light / dark / sepia), and rich analytics. Fully static, runs on GitHub Pages, local-first with optional Google Sheets sync.

**Live site:** `https://md-melon-ahmed.github.io/IPQC-Dashboard/`

---

## Features

**Workspace landing** (ALEL Pulse style)
- Two glass cards → **Entry** (IQC/IPQC) and **Dashboard**
- Theme toggle ☀ → 🌙 → ☕ · Language toggle EN / বাং

**IQC Entry — Incoming material inspection**
- LOT/LC, received & inspection dates (Today shortcut), ODM autocomplete, material code/description
- Lot size, sample qty (AQL), Check status
- Critical / Major / Minor defect counts with **auto AQL decision** (ISO-2859-1 Level II)
  - Critical 0% → any critical defect fails
  - Major > 0.65% → fails · Minor > 1.5% → fails
- Auto Total NG, NG %, PASSED/FAILED, recent entries table
- Month sheet selector (Sep-26 … Jan-26)

**IPQC Entry — In-process checks** (two modes)
- **Line-Level Check:** section, assembly line, date, hour, model/item, checked / passed / repaired / failed qty, dynamic defect-type rows (`+ Add defect type`), auto **FPY**
- **Section Roll-up:** quick monthly per-section aggregate → FPY
- Recent entries table

**Dashboard** (ApexCharts)
- IQC tab: KPI row (total lots, passed, pass rate, qty, NG), pass-rate trend with 95% target line, pass/fail donut, daily IQC matrix (CSV export)
- IPQC tab: KPIs (overall FPY, total defectives, best section), FPY by section bar, FPY by date line, defect Pareto (bar + cumulative %), volume donut, quality scorecard (Good/OK/Poor, CSV export)

---

## Data storage

**Local-first:** every entry is saved in your browser (localStorage) — nothing is lost on refresh.

**Optional Google Sheets sync:** the dashboard can POST entries to Apps Script Web Apps you deploy. See `backend/`.

| Module | Backend file | Target |
|--------|-------------|--------|
| IQC | `backend/Code-IQC.gs` | Daily IQC Report-Local Item (2026) |
| IPQC | `backend/Code-IPQC.gs` | Daily IPQC Report workbook |

**Connect (one-time):**
1. Open the target Google Sheet → Extensions → Apps Script → paste the matching `.gs` → Save.
2. Deploy → New deployment → Web app (*Execute as Me*, *Access Anyone*) → copy the `/exec` URL.
3. In the dashboard, store the URL under `iqcEp` / `ipqcEp` in your browser localStorage (add a small Settings panel or paste via DevTools):
   ```js
   localStorage.setItem('iqcEp',  'https://script.google.com/macros/s/.../exec');
   localStorage.setItem('ipqcEp', 'https://script.google.com/macros/s/.../exec');
   ```

---

## Local development

```bash
python -m http.server 8000
# open http://localhost:8000
```

---

## File map

```
index.html          SPA (landing / chooser / IQC app / IPQC app / dashboard)
css/style.css       ALEL-Pulse-style theme (light/dark/sepia, glassmorphism)
js/app.js           entry logic, AQL/FPY calc, storage, dashboard & charts
backend/Code-IQC.gs     Google Apps Script backend — IQC
backend/Code-IPQC.gs    Google Apps Script backend — IPQC
```

---

*Akij Light Engineering Ltd. · IQC Form ALEL-QC-IQC-F001/25 · v2026.09.02*
