# IQC & IPQC Data Entry Dashboard

A combined **Quality Control** dashboard for **Akij Light Engineering Ltd.** with three modules:

1. **IQC — Incoming** : daily incoming-material inspection entries (mirrors *Daily IQC Report-Local Item (2026)*).
2. **IPQC — In-Process** : two entry modes
   - **Line-Level** — per-line, per-hour in-process checks with defect capture and auto **FPY**.
   - **Section Roll-up** — quick monthly section aggregates.
3. **FPY Analytics** — auto-roll-up of IPQC (and IQC pass-rate) into section/date charts.

Live site: `https://md-melon-ahmed.github.io/IPQC-Dashboard/`

---

## Features

- **Local-first saving** — every entry is stored in your browser (survives refresh) with live recent-entry tables.
- **Auto calculations**
  - IQC: Total NG, NG%, and Pass/Fail using AQL limits (Critical 0% / Major 0.65% / Minor 1.5%).
  - IPQC: FPY = Passed ÷ Checked × 100, plus defect totals.
- **Optional Google Sheets sync** — via two small Apps Script backends (one per module).
- ODM supplier autocomplete, dark responsive UI, Chart.js analytics.

---

## Screens / Modes

| Tab | Purpose |
|-----|---------|
| IQC — Incoming | LOT/LC, dates, ODM, material, lot/sample qty, defect counts → auto AQL result |
| IPQC — In-Process | line-level checks (section, table, hour, item, qty, 10 defect types) OR section roll-up |
| FPY Analytics | FPY by section + by date, IQC pass rate, detailed table |

---

## Google Sheets connection (optional)

Because the site is static, it talks to your sheets through **Apps Script Web Apps**.

### IQC backend
1. Open **Daily IQC Report-Local Item (2026)** spreadsheet.
2. **Extensions → Apps Script** → paste contents of [`backend/Code-IQC.gs`](backend/Code-IQC.gs) → Save.
3. **Deploy → New deployment → Web app**: *Execute as Me*, *Access: Anyone* → copy URL (ends `/exec`).
4. Dashboard **⚙ Settings → IQC Apps Script URL** → paste → Save.

### IPQC backend
1. Open or create your **Daily IPQC Report** spreadsheet.
2. Paste the spreadsheet **ID** into `IPQC_SHEET_ID` at the top of [`backend/Code-IPQC.gs`](backend/Code-IPQC.gs). (Leave blank and it will auto-create `Daily IPQC Report`.)
3. Deploy as a Web App (same steps) → paste URL into **Settings → IPQC Apps Script URL**.

> Entries always save a local copy first, so nothing is lost if offline.

---

## Local development

```bash
python -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` in a browser.

---

*Akij Light Engineering Ltd. · IQC Form ALEL-QC-IQC-F001/25 · IPQC in-process checks*
