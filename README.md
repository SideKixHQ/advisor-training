[README-Advisor Training.md](https://github.com/user-attachments/files/32029178/README-Advisor.Training.md)
# SideKix Advisor Training

A single file training and certification app for SideKix Advisors. Nine modules,
each with teaching content, practice scenarios, a five question knowledge check,
an acknowledgment step and a printable certificate. Completions, quiz attempts
and feedback are logged to a Google Sheet through an Apps Script endpoint.

---

## Files

| File | What it is |
|---|---|
| `sidekix-advisor-training.html` | The entire app. One file, no build step, no dependencies. Open it in a browser or host it anywhere static. |
| `apps-script-update.gs` | The Apps Script that receives posts from the app and writes rows to the tracker spreadsheet. Bound to the "Advisor Training Tracker" sheet. |

The HTML file is roughly 280 KB and includes all markup, CSS, JavaScript and
content. Fonts load from Google Fonts; everything else is inline.

---

## The nine modules

| # | Module | ID | Prefix | Waypoints | Scenarios | Est. |
|---|---|---|---|---|---|---|
| 1 | The SideKix Mission & Advisor Role | `brand-mission` | `bm` | 6 | 1 | 10–15 min |
| 2 | The Advisor Framework | `advisor-framework` | `af` | 8 | 4 | 20–30 min |
| 3 | Protecting the Member Relationship | `ethics-integrity` | `ei` | 9 | 3 | 15–20 min |
| 4 | Navigating Real-World Conversations | `scenario-training` | `sc` | 4 | 1 | 15–20 min |
| 5 | The Art of Asking | `art-of-asking` | `aq` | 7 | 1 | 15–20 min |
| 6 | Meeting Members Where They Are | `member-context` | `mc` | 8 | 3 | 20–30 min |
| 7 | Trust, Guidance & the Member Relationship | `trust-relationship` | `tr` | 10 | 4 | 20–30 min |
| 8 | Momentum & Breakthroughs | `momentum-breakthroughs` | `mb` | 8 | 3 | 20–30 min |
| 9 | Continuity, Community & Growth | `notes-community` | `nc` | 8 | 4 | 20–30 min |

Modules 2, 6, 7, 8 and 9 were consolidated from an earlier sixteen module
version. The **ID** is what appears in the spreadsheet and in `localStorage`.
The **prefix** namespaces that module's element IDs and its global functions
(`af_goTo`, `af_nextQ`, `af_showCert` and so on).

---

## How it works

### Structure

The app is a single page with ten screens: a hub plus nine module screens. Only
one screen is visible at a time; `showScreen(id)` toggles `display` and moves
focus to that screen's `<h1>`. There is no router and no URL state, so a browser
refresh returns to the hub.

Each module screen contains its teaching sections, a practice section, a
knowledge check, and a certificate section, followed by its own IIFE holding
that module's waypoint nav, scenarios and quiz. Modules do not share state.

### The advisor's path through a module

1. On first load a modal asks for the advisor's name. It is stored in
   `localStorage` and used on every record sent to the sheet.
2. The hub lists all nine modules with status, and picks up where they left off.
3. Inside a module, a sticky waypoint strip tracks scroll position through the
   sections.
4. Practice scenarios present a member statement and three responses. Choosing
   one reveals which was strongest and why. These are not scored.
5. The knowledge check is five questions, one at a time, with immediate
   feedback. Answer options are shuffled on render with Fisher-Yates.
6. **4 out of 5 is a pass.** A pass reveals the acknowledgment checkbox; the
   certificate stays locked until it is checked.
7. The certificate prints or saves to PDF via the browser's print dialog, with
   the advisor's name prefilled.
8. A feedback block appears on the results screen whether they passed or failed.

### Storage

Two `localStorage` keys:

- `sidekix_advisor_name`: the name string
- `sidekix_training_progress`: an object keyed by module ID:

```json
{
  "advisor-framework": {
    "status": "completed",
    "startedAt": "2026-09-09T21:50:00.000Z",
    "completedAt": "2026-09-09T22:05:00.000Z",
    "attempts": 3,
    "score": 4,
    "total": 5
  }
}
```

Progress is per browser, per device. Clearing site data resets the hub to zero
completions even though the spreadsheet still holds the record. See
*Known limitations*.

---

## Data flow to the spreadsheet

All three record types post to the same Apps Script URL, hardcoded once at
`const APPS_SCRIPT_URL` in the HTML. The script routes on the `type` field.

### `type: "completion"` → tab `Sheet1`

Sent when a module is passed. **Upserted**, not appended: a repeat pass by the
same Advisor Name and Training ID updates that row rather than creating a
second one. Matching is trimmed and case insensitive, so `sasha` matches
`Sasha `.

```json
{"type":"completion","name":"Jane Doe","trainingId":"advisor-framework",
 "trainingTitle":"The Advisor Framework",
 "startedAt":"2026-09-09T21:50:00.000Z","completedAt":"2026-09-09T22:05:00.000Z",
 "score":4,"total":5,"result":"Pass","attempts":3}
```

Columns: Timestamp, Advisor Name, Training, Training ID, Started At,
Completed At, Score, Out Of, Result, Attempts.

On a repeat pass, Completed At, Score, Out Of, Result and Attempts are
overwritten. Timestamp and Started At keep their original values, so the pair
reads as first completion and most recent completion.

### `type: "attempt"` → tab `Attempts`

Sent on **every** finished knowledge check, pass or fail. Always appends, so
this tab is the full history: who retook what and what they scored each time.

```json
{"type":"attempt","name":"Jane Doe","trainingId":"advisor-framework",
 "trainingTitle":"The Advisor Framework","score":2,"total":5,
 "result":"Fail","attempt":1,"attemptedAt":"2026-09-09T22:00:00.000Z"}
```

Columns: Attempted At, Advisor Name, Training, Training ID, Attempt No, Score,
Out Of, Result.

`Sheet1` answers who is certified. `Attempts` answers who is struggling and
which module is causing it.

### `type: "feedback"` → tab `Feedback`

Two sources. `source: "module"` comes from the block on a module's results
screen and carries a 1–5 rating plus an optional comment. `source: "general"`
comes from the hub buttons and carries a topic plus a comment.

```json
{"type":"feedback","name":"Jane Doe","submittedAt":"2026-09-09T22:10:00.000Z",
 "source":"module","trainingId":"art-of-asking","trainingTitle":"The Art of Asking",
 "rating":"4","comment":"Level 3 needed another example."}
```

Columns: Submitted At, Advisor Name, Source, Training, Training ID, Topic,
Rating, Comment. Rating is stored as a number so the column averages cleanly.

### Other routing behaviour

- A payload with **no** `type` is treated as a completion, matching how the
  original script behaved, so nothing sent before the update is misfiled.
- An **unrecognised** type lands in an `Unrouted` tab with the raw body.
- A parse or write failure lands in an `Errors` tab with the timestamp, the
  error and the raw body.
- Tabs are created on first write, with a bold frozen header row.
- Rows are written by column **name**, not position. Reordering columns in the
  spreadsheet will not misalign new rows, and adding a field to a handler
  appends a new column on the right while existing rows stay aligned.
- `doPost` takes a script lock, so two posts arriving together cannot both miss
  the same row and append twice.

---

## Deploying

### Order matters

Update the Apps Script **before** distributing a new HTML file. If advisors get
a version that sends attempt or feedback records while the old script is live,
those rows land in `Sheet1` in the wrong shape.

### Apps Script

1. Open the Apps Script editor from the tracker spreadsheet.
2. Select all, paste `apps-script-update.gs` over it, save.
3. **Deploy → Manage deployments**, pencil icon on the existing deployment,
   set **Version: New version**, then **Deploy**.

Editing the existing deployment is what keeps the URL stable. Creating a new
deployment issues a different URL, and the app has the old one hardcoded, so
completions would stop arriving with no visible error anywhere.

Deployment settings that need to stay as they are: **Execute as** the sheet
owner (this is what lets the script write without advisors needing sheet
access), and **Who has access: Anyone** (the app posts unauthenticated).

### The app

Host the HTML anywhere static, or send the file directly. No build step.

### Verifying a deploy

- **Executions** in the Apps Script sidebar lists every `doPost` run with its
  status. An empty list means nothing is reaching Google at all.
- **Manage deployments** shows the live version number. If it has not
  incremented, the deploy did not take.
- Finish one module and confirm a row appears in `Sheet1` under the right
  headers.

---

## Editing content

### Changing a quiz question

Each module's quiz is a `const quiz = [...]` array inside that module's IIFE.
`correct` is a zero based index into `opts`. Options are shuffled at render, so
the index position does not affect where the answer appears.

Two properties of the current question set are worth preserving:

- **Five questions per module.** The pass rule is a literal `score >= 4`. A
  module with four questions would silently require 100%.
- **The true/false answer key is balanced**, currently 4 True and 4 False across
  the eight true/false questions. An earlier version had all fifteen answering
  False, which let anyone who noticed pass that question without reading.

### Changing a practice scenario

Each module has a `const scenarios = [...]` array. Each entry has a `member`
line and three `options`, each typed `strong`, `okay` or `weak`, with a `fb`
explanation. Exactly one option per scenario is `strong`.

### Adding or removing a section

Sections are `<section class="block" id="...">`. The waypoint strip is built
from that module's `waypoints` array, which maps section IDs to nav labels.
Adding a section means adding a matching waypoint entry, and the
`<div class="kicker">Waypoint NN</div>` numbering is manual.

### Adding a module

1. Add an entry to the `TRAININGS` array in the hub script. Order in that array
   drives hub order and the next-module chain.
2. Add a `<div id="screen-{id}" class="screen" style="display:none;">` block
   following the pattern of an existing module, with a fresh two letter prefix
   on every element ID and global function.

### Terminology

The person being advised is a **member** throughout. `founder`, `entrepreneur`
and `business owner` appear only where they describe the wider population
SideKix serves, refer to entrepreneurship as a practice, or sit inside a line
an Advisor speaks aloud to a member.

---

## Accessibility

Built against WCAG 2.1 AA.

- **Contrast.** Every text and interactive border combination in the palette
  was measured. Body text runs 13:1 or better on the dark background, muted
  captions 5.2:1 to 6.5:1 against a 4.5 requirement, and interactive borders
  3.5:1 against a 3.0 requirement.
- **Colour is never the only signal.** Correct and incorrect answers carry
  visible text labels in addition to the green and red borders.
- **Focus.** A 3px gold focus ring at 8.76:1 on every focusable element. Focus
  moves to the module heading when a module opens.
- **Target size.** Waypoints and back links are 44px minimum; answer buttons and
  rating buttons 48px.
- **Screen readers.** Live regions on the question counter and answer feedback,
  `aria-hidden` on decorative diamonds and arrows, `aria-label` on every input,
  `aria-pressed` on the rating buttons, dialog roles on both modals, a skip
  link, and no skipped heading levels on any screen.
- **Motion.** A `prefers-reduced-motion` query disables smooth scrolling and
  transitions.

### Mobile

Breakpoints at 780px, 720px, 680px, 560px and 360px. At phone width the hero
scales down, two column lists collapse to one, loop diagrams stack vertically
with arrows rotated, buttons go full width, and the certificate name field
becomes fluid. The waypoint strip scrolls horizontally with the scrollbar
hidden, which matters most on Module 7 with its ten waypoints.

---

## Known limitations

**Progress is browser local.** Clearing site data or opening the training on a
second device shows all nine modules as Not Started even though the sheet holds
the record. Fixing this means a `doGet` handler in the Apps Script plus a
lookup on load, keyed on the advisor's name.

**Writes are fire and forget.** The `fetch` uses `mode: 'no-cors'`, so the
response is opaque and the app never reads it. A certificate appears whether or
not the row reached the sheet. A silent failure is invisible to the advisor and
to the app.

**Completion is recorded on the pass, not on the acknowledgment.**
`markCompleted` fires when the quiz is passed, so an advisor who passes and
never checks the acknowledgment box still appears in `Sheet1`.

**The endpoint is unauthenticated.** The URL sits in client side source, and
access is set to Anyone, so anyone holding it can post rows. There is no
personal data in the tracker; the realistic exposure is junk rows, and the
realistic fix is rotating the deployment URL.

**Date types are mixed in `Sheet1`.** Rows written before the script update hold
ISO strings; new rows write real Date values. Sorting and filtering on those
columns will behave inconsistently until the older cells are converted.

---

## Testing

There is no test suite in the repo. The build was validated by loading the file
in a headless DOM (jsdom), intercepting outbound posts, and driving each module
end to end: answering every quiz correctly, checking the acknowledgment,
claiming the certificate, and inspecting the payload that would have reached
the sheet.

Worth re-running after any content change:

- All nine modules pass and produce one completion record each, with nine
  distinct training IDs.
- The next-module chain walks 1 through 9 and returns to the hub.
- Every quiz has exactly five questions and every `correct` index is in range.
- No duplicate question stems anywhere in the file.
- No duplicate element IDs; tags balanced; every script block parses.
- Every waypoint entry resolves to a real section.

The Apps Script logic can be exercised the same way by stubbing
`SpreadsheetApp`, `LockService` and `ContentService` and calling `doPost`
directly with sample payloads.

---

## Quick reference

| Thing | Value |
|---|---|
| Modules | 9 |
| Questions | 45 (5 per module) |
| Pass mark | 4 / 5 |
| Practice scenarios | 24 |
| Sections | 77 |
| Progress key | `sidekix_training_progress` |
| Name key | `sidekix_advisor_name` |
| Sheet tabs | `Sheet1`, `Attempts`, `Feedback`, `Unrouted`, `Errors` |
| Record types | `completion`, `attempt`, `feedback` |
