/**
 * IQC Data Entry Dashboard — backend (Incoming Quality Control)
 *
 * SETUP:
 * 1. Open "IQC Master Data" Google Sheet
 *    https://docs.google.com/spreadsheets/d/1hKodbuw1pAEzk91qiEw0WeqxY2byEuTZfKRgpqUFBNo
 * 2. Extensions > Apps Script > paste this file > Save
 * 3. Deploy > New deployment > Web app
 *      Execute as: Me   |   Who has access: Anyone
 * 4. Copy URL (ends /exec) -> paste into dashboard Settings (IQC URL).
 *
 * BEHAVIOUR: appends each IQC entry to the first sheet ("Sheet1") as a
 * running master log. Header row is created automatically if missing.
 * SN auto-increments.
 */
var IQC_SHEET_ID = "1hKodbuw1pAEzk91qiEw0WeqxY2byEuTZfKRgpqUFBNo";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(IQC_SHEET_ID);
    var sheet = ss.getSheets()[0]; // first sheet (Sheet1) = master log
    ensureHeader(sheet);
    var row = nextRow(sheet);
    var sn = body.sn || row; // honour supplied sn if present
    var values = [
      sn, body.lot || "", toDate_(body.dateRec), toDate_(body.dateIns), body.odm || "",
      body.code || "", body.desc || "", body.lotSize || "", body.sample || "",
      body.status || "Complete",
      body.critical == null ? "-" : (body.critical === 0 ? "-" : body.critical),
      body.major == null ? "-" : (body.major === 0 ? "-" : body.major),
      body.minor == null ? "-" : (body.minor === 0 ? "-" : body.minor),
      body.totalNG || 0, body.result || "PASSED",
      body.ngPct != null ? Number(body.ngPct.toFixed(4)) : 0,
      body.failDesc || "-", body.picture || "-", body.remarks || "-",
      new Date()
    ];
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
    return json_({ status: "ok", row: row, sn: sn });
  } catch (err) {
    return json_({ status: "error", message: String(err) });
  }
}

function doGet() {
  return json_({ status: "ok", message: "IQC Master Data backend running" });
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() >= 1 && sheet.getRange(1, 1).getValue() !== "") return;
  var h = ["SN","LOT/LC NO","DATE OF RECEIVED","DATE OF INSPECTION","ODM NAME","MATERIAL CODE",
    "MATERIAL DESCRIPTION","LOT SIZE","SAMPLE QTY (AQL)","CHECK STATUS","CRITICAL","MAJOR (0.65%)",
    "MINOR (1.5%)","TOTAL NG QTY","RESULT (PASS/FAIL)","NG %","FAIL DESCRIPTION","PICTURE","Remarks","Timestamp"];
  sheet.getRange(1, 1, 1, h.length).setValues([h]);
  sheet.getRange(1,1,1,h.length).setFontWeight("bold").setBackground("#0D5C58").setFontColor("#ffffff");
}

function nextRow(sheet) {
  var last = sheet.getLastRow();
  return last + 1; // append after last (header row 1, first data row 2)
}

function toDate_(s) {
  if (!s) return "";
  var p = String(s).split("-");
  if (p.length === 3) return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
