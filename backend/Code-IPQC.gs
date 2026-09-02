/**
 * IPQC Data Entry Dashboard — backend (In-Process Quality Control)
 *
 * This appends line-level IPQC checks OR section roll-ups to a Google Sheet.
 * Choose the destination spreadsheet by editing IPQC_SHEET_ID below, or create a
 * "Daily IPQC Report" workbook (one sheet per month) and set its ID.
 *
 * SETUP:
 * 1. Open (or create) your "Daily IPQC Report - 2026" Google Sheet.
 * 2. Extensions > Apps Script > paste this file > Save
 * 3. Deploy > New deployment > Web app
 *      Execute as: Me   |   Who has access: Anyone
 * 4. Copy URL -> paste into dashboard Settings (IPQC URL).
 */
var IPQC_SHEET_ID = ""; // <-- PUT YOUR IPQC SPREADSHEET ID HERE
var IPQC_SHEET_NAME = "Daily IPQC Report"; // fallback workbook name for create

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet_(IPQC_SHEET_ID, IPQC_SHEET_NAME);
    var month = body.month || currentMonthName();
    var sheet = ss.getSheetByName(month) || ss.insertSheet(month);
    if (body.module === "ipqc-section") {
      ensureIpqcSectionHeader(sheet);
      var row = nextRow_(sheet);
      sheet.getRange(row, 1, 1, 7).setValues([[
        row - 1, body.date || "", body.section || "", body.checked || 0, body.passed || 0,
        body.fpy != null ? Number(body.fpy.toFixed(2)) : 0, body.remarks || ""
      ]]);
    } else {
      ensureIpqcLineHeader(sheet);
      var r2 = nextRow_(sheet);
      var d = body.defects || {};
      sheet.getRange(r2, 1, 1, 21).setValues([[
        r2 - 1, body.date || "", body.section || "", body.line || "", body.hour || "",
        body.code || "", body.item || "", body.checked || 0, body.passed || 0,
        body.repaired || 0, body.failed || 0, body.defectTotal || 0,
        body.fpy != null ? Number(body.fpy.toFixed(2)) : 0,
        d.connection||0, d.circuit||0, d.scratch||0, d.spot||0, d.print||0, d.fitting||0,
        d.color||0, d.metal||0, d.nut||0, d.dirt||0,
        body.remarks || ""
      ]]);
    }
    return json_({ status: "ok" });
  } catch (err) {
    return json_({ status: "error", message: String(err) });
  }
}

function doGet() {
  return json_({ status: "ok", message: "IPQC backend running" });
}

function getSpreadsheet_(id, name) {
  if (id) return SpreadsheetApp.openById(id);
  var files = DriveApp.getFilesByName(name);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  return SpreadsheetApp.create(name);
}

function nextRow_(sheet) {
  var last = sheet.getLastRow();
  if (last < 1) return 1;
  var vals = sheet.getRange(1, 1, last, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (vals[i][0] === "" || vals[i][0] == null) return i + 1;
  return last + 1;
}

function ensureIpqcLineHeader(sheet) {
  var h = ["SN","DATE","SECTION","LINE","HOUR","MODEL CODE","ITEM NAME","CHECKED","PASSED","REPAIRED",
    "FAILED","DEFECT TOTAL","FPY %","CONNECTION","CIRCUIT","SCRATCH","SPOT","PRINT","FITTING","COLOR","METAL","NUT","DIRT","REMARKS"];
  if (sheet.getLastRow() < 1) sheet.getRange(1, 1, 1, h.length).setValues([h]);
}

function ensureIpqcSectionHeader(sheet) {
  var h = ["SN","DATE","SECTION","CHECKED","PASSED","FPY %","REMARKS"];
  if (sheet.getLastRow() < 1) sheet.getRange(1, 1, 1, h.length).setValues([h]);
}

function currentMonthName() {
  var n = ["Jan-26","Feb-26","Mar-26","Apr-26","May-26","June-26","July-26","Aug-26","Sep-26","Oct-26","Nov-26","Dec-26"];
  return n[new Date().getMonth()];
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
