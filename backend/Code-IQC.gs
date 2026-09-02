/**
 * IQC Data Entry Dashboard — backend (Incoming Quality Control)
 *
 * SETUP:
 * 1. Open "Daily IQC Report-Local Item (2026)" Google Sheet
 * 2. Extensions > Apps Script > paste this file > Save
 * 3. Deploy > New deployment > Web app
 *      Execute as: Me   |   Who has access: Anyone
 * 4. Copy URL (ends /exec) -> paste into dashboard Settings (IQC URL).
 */
var IQC_SHEET_ID = "1eoZ8JTIZ2Qqv1oKN5sgh1KvEaVslr8tYIAH24oGNS_A";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(IQC_SHEET_ID);
    var month = body.month || currentMonthName();
    var sheet = ss.getSheetByName(month) || ss.insertSheet(month);
    ensureIqcHeader(sheet);
    var row = findNextIqcRow(sheet);
    var sn = row - 8;
    var values = [
      sn, body.lot || "", toDate_(body.dateRec), toDate_(body.dateIns), body.odm || "",
      body.code || "", body.desc || "", body.lotSize || "", body.sample || "",
      body.status || "Complete",
      body.critical == null ? "-" : (body.critical === 0 ? "-" : body.critical),
      body.major == null ? "-" : (body.major === 0 ? "-" : body.major),
      body.minor == null ? "-" : (body.minor === 0 ? "-" : body.minor),
      body.totalNG || 0, body.result || "PASSED",
      body.ngPct != null ? Number(body.ngPct.toFixed(4)) : 0,
      body.failDesc || "-", body.picture || "-", body.remarks || "-"
    ];
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
    return json_({ status: "ok", row: row, sn: sn });
  } catch (err) {
    return json_({ status: "error", message: String(err) });
  }
}

function doGet() {
  return json_({ status: "ok", message: "IQC backend running" });
}

function currentMonthName() {
  var n = ["Jan-26","Feb-26","Mar-26","Apr-26","May-26","June-26","July-26","Aug-26","Sep-26","Oct-26","Nov-26","Dec-26"];
  return n[new Date().getMonth()];
}

function findNextIqcRow(sheet) {
  var last = sheet.getLastRow();
  if (last < 9) return 9;
  var vals = sheet.getRange(9, 1, last - 8, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (vals[i][0] === "" || vals[i][0] == null) return 9 + i;
  return last + 1;
}

function ensureIqcHeader(sheet) {
  var h = ["SN","LOT/LC NO","DATE OF RECEIVED","DATE OF INSPECTION","ODM NAME","MATERIAL CODE",
    "MATERIAL DESCRIPTION","LOT SIZE","SAMPLE QTY (BY AQL)","CHECK STATUS","CRITICAL (0%)","MAJOR (0.65%)",
    "MINOR (1.5%)","TOTAL NG QTY","RESULT (PASSED/FAILED)","NG %","FAIL DESCRIPTION (IF ANY)","PICTURE","Remarks"];
  if (sheet.getLastRow() < 7) sheet.getRange(7, 1, 1, h.length).setValues([h]);
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
