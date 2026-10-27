/**
 * FinanzGame – Bestenliste in Google Sheets
 * Einrichtung: siehe README.md, Abschnitt «Bestenliste einrichten».
 * Gespeichert werden nur Spitzname, Punkte, Variante, Datum und Endwerte.
 */

const SHEET_NAME = "Bestenliste";
const MAX_ENTRIES = 50;

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["Datum", "Spitzname", "Punkte", "Variante", "Endwerte"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Bestenliste lesen: ...?variant=abc123
function doGet(e) {
  const variant = String((e && e.parameter && e.parameter.variant) || "");
  const rows = sheet_().getDataRange().getValues().slice(1);
  const entries = rows
    .filter(r => r[1] !== "" && String(r[3]) === variant)
    .map(r => ({ date: new Date(r[0]).toISOString(), name: String(r[1]), score: Number(r[2]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  return json_({ ok: true, entries });
}

// Neuen Eintrag speichern
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    let name = String(d.name || "").replace(/[<>]/g, "").trim().slice(0, 20);
    // Verhindert, dass ein Spitzname wie «=SUMME(...)» als Formel ausgeführt wird
    if (/^[=+\-@]/.test(name)) name = "'" + name;
    const score = Math.round(Number(d.score));
    const variant = String(d.variant || "").slice(0, 12);
    if (!name || !(score >= 0 && score <= 100)) return json_({ ok: false, error: "Ungültiger Eintrag" });
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      sheet_().appendRow([new Date(), name, score, variant, JSON.stringify(d.values || {})]);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
