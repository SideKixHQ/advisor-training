/**
 * Advisor Style handler for the Advisor Training Tracker.
 *
 * The training app posts {type:"style", ...} when an advisor finishes the
 * Advisor Style Discovery. Until this handler is added, those posts land in
 * the "Unrouted" tab with the raw body, so nothing is lost.
 *
 * Style names match the SideKix app exactly: Action Oriented,
 * Supportive & Encouraging, Strategic, Challenging & Honest, Collaborative.
 *
 * To install:
 *   1. Paste handleStyle() below into the existing script.
 *   2. In doPost, next to the other type checks, add:
 *        if (body.type === 'style') return handleStyle(body);
 *      (adapt to however the existing router returns its response)
 *   3. Deploy > Manage deployments > edit the existing deployment >
 *      Version: New version > Deploy. Do not create a new deployment.
 *
 * Writes one row per advisor to the "Styles" tab, upserted on Advisor Name,
 * so the tab always holds each advisor's current style for app filtering and
 * AI pairing.
 *
 * Retakes are limited to once every 30 days. The training app enforces this
 * on the advisor's device; this handler enforces it at the source, so a retake
 * from a cleared browser or a second device inside the window does not
 * overwrite the stored style. Blocked retakes are logged to "Style Retakes
 * Blocked" for visibility.
 */
var STYLE_RETAKE_DAYS = 30;
function handleStyle(body) {
  var HEADERS = ['Advisor Name', 'Primary Style', 'Secondary Style',
                 'Action Oriented', 'Supportive & Encouraging', 'Strategic',
                 'Challenging & Honest', 'Collaborative',
                 'Answers', 'Attempts', 'First Completed At', 'Last Completed At'];
  var FIRST_COL = 11; // First Completed At, 1-based
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Styles');
  if (!sh) {
    sh = ss.insertSheet('Styles');
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  var name = String(body.name || 'Unknown').trim();
  var at = body.completedAt || new Date().toISOString();
  var row = [name, body.primaryStyle || '', body.secondaryStyle || '',
             Number(body.actionOriented) || 0, Number(body.supportiveEncouraging) || 0,
             Number(body.strategic) || 0, Number(body.challengingHonest) || 0,
             Number(body.collaborative) || 0,
             body.answers || '', Number(body.attempts) || 1, at, at];

  var last = sh.getLastRow();
  if (last > 1) {
    var names = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (String(names[i][0]).trim().toLowerCase() === name.toLowerCase()) {
        var r = i + 2;
        var lastAt = new Date(sh.getRange(r, 12).getValue()).getTime();
        if (lastAt && (new Date(at).getTime() - lastAt) < STYLE_RETAKE_DAYS * 864e5) {
          var log = ss.getSheetByName('Style Retakes Blocked') || ss.insertSheet('Style Retakes Blocked');
          if (log.getLastRow() === 0) log.appendRow(['Attempted At', 'Advisor Name', 'Primary Style', 'Last Completed At']);
          log.appendRow([at, name, body.primaryStyle || '', sh.getRange(r, 12).getValue()]);
          return ContentService.createTextOutput(JSON.stringify({ok: false, blocked: 'retake window'}))
            .setMimeType(ContentService.MimeType.JSON);
        }
        row[FIRST_COL - 1] = sh.getRange(r, FIRST_COL).getValue() || at; // keep first completion
        sh.getRange(r, 1, 1, row.length).setValues([row]);
        return ContentService.createTextOutput(JSON.stringify({ok: true, updated: true}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  sh.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ok: true, updated: false}))
    .setMimeType(ContentService.MimeType.JSON);
}
