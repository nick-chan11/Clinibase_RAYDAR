# RAYDAR 2.12 (React + Motion)

A component-based port of `RAYDAR_2.2.html`, built to use the full charles-ux-animation skill.

## New in 2.12

- **Travel fixed.** In 2.11 the Travel list opened empty in the built file: next to a studies folder published
  before 2.11 (here `_system/`), RAYDAR used that folder's study settings, which have no site addresses. It now
  falls back to the addresses it was built with (`BUILT_SETTINGS`, `src/views/Travel.jsx`). The list also opened
  inside its card, under the boxes below it; it now floats above the page. `npm run test:offline` checks Travel in
  the built file.
- **Section notice (F1).** When the questions move into a new section, a strip above the question says "New
  section: <name> · Section 2 of 5 · 18 questions" for 5 seconds, then folds away (stays while the mouse is over it).
  Not on the first question or on switching study (`SectionNote`, `src/views/PreScreen.jsx`).
- **Details before booking.** For a booking (Clear to book, or Doctor enquiry with Book now), Finish asks for any of
  name, phone and email still empty, and Save PDF waits until they're filled in. Exclude and callbacks aren't held
  up; test mode skips it (`NeedDetails`, `src/views/Finish.jsx`).
- **Postcode in the callback PDF**, so a reopened call can check travel again. Name, phone and email still never go
  in.
- **Change the postcode from any Travel list.** Every Travel list (header, Quick check, study list, questions) has
  the postcode as an editable box at the top. There is one postcode per call, so a correction anywhere changes every
  Travel button, the Identity screen and the callback PDF. The header shows "Travel · add postcode" until there is
  one, and stays in the slim header.
- **Check a list: add now, details later.** As soon as a list is checked, "Add these 5 to the med log?" (Add all /
  Not now) sits between the box and the results. The med log then says how many from the list still need details,
  and "Fill in details, one by one" opens each in turn ("Save and next"; Cancel stops) (`fillNext` in
  `src/engine/store.js`).
- **Medications search shows only what was typed.** The list's own words are searched only when RAYDAR doesn't
  recognise the name, on item names from the start of a word, never the eSource heading above an item (typing "me"
  used to bring up OLX's Minoxidil items through "Some examples include:").

## New in 2.11

Chosen from the mockups in `mockups/2026-11 RAYDAR 2.11/`.

- **Test mode keeps the dates and study information.** A study opens on its visit timeline and study information,
  as in a real call, with "Go to questions" straight away and nothing to confirm; "Dates and study info" on the
  questions toolbar goes back (`src/views/PreScreen.jsx`).
- **Participant details.** Identity asks for full name, phone and email (required: "Still needed" shows until they
  are filled in) and an optional postcode (`src/views/Intake.jsx`). Name, phone and email stay on screen only:
  never in the PDF, the callback file or the Dr enquiry; they clear when the call ends. Enter in any of the boxes
  confirms identity.
- **Travel time (Google Maps).** With a postcode, Travel opens Google Maps directions in a separate window, by car
  or public transport, from the postcode to the study's site or another place its eSource names
  (`src/views/Travel.jsx`). In the header ("3150 · Travel"), a Quick check row (OK / Too far, noted only, never a
  rule), beside each study in Pivotable studies, and on a question that names an address ("Travel from 3150 to
  1096 Toorak Rd, Camberwell"). No Google key, no cost, nothing to install; only the postcode leaves RAYDAR.
  Addresses are in `../RAYDAR study settings.json`: `sites` (Emeritus Melbourne 1096 Toorak Rd Camberwell,
  Emeritus Sydney Suite 2/12 Lord St Botany, Veritus 885 Mountain Hwy Bayswater) and per study `locations`, the
  other places its eSource names (scan locations), with the eSource's words.
- **Check a list** in the Prohibited list panel ("Search one | Check a list", `src/views/ListCheck.jsx`,
  `src/medicines/list.js`): one medicine per line, names first. Spelling fixed ("metfor,in" → Metformin);
  "Which one?" / "Did you mean?" with "None of these" when unsure; unknown names kept as typed; each checked
  against the chosen study; "Add all to the med log" with any dosage and frequency typed after the name.
- **Header and scrolling.** The header keeps its full space in the page and slides between full and slim
  (220 ms; instant with reduced motion), so slimming never changes the page's height. Before, the page shrank by
  ~106 px, the browser pulled the scroll up and the side panel pushed it back down: the jump at the bottom of short
  pages. Pages with little to scroll keep the full header (`src/App.jsx`).
- New tests: `npm run test:scroll`, `npm run test:details`; `test:testmode`, `test:suggest` and `test:medicines`
  cover the rest.

## New in 2.10

Chosen from the mockups in `mockups/2026-11 search, test mode, branding/` (search S1, test mode T1, branding A).

- **Prohibited-list search suggests as you type** (`MedLookup` in `src/views/Medicines.jsx`). From the third
  letter it lists the medicines whose name starts with what's typed, each with the chosen study's result
  (Excluded, Doctor check, Not on the list). The highlighted one shows labelled tags: Drug class; for a brand, its
  Active ingredient(s) (each with its own class for combinations) and "Same as" (other brands of the same
  medicine); then the list item, its time window, the eSource wording and Add to med log. Close spellings sit under
  their own heading. "RAYDAR doesn't recognise …" only shows when nothing starts with the name and nothing is spelt
  close to it. Arrows move, Enter or Tab picks, Esc clears. Drug classes come from the PBS groups at the level a
  recruiter knows (`classOf` in `src/medicines/dict.js`), with a short approved list of plain names where the PBS
  wording is clinical (`CLASS_WORDS`). No "Common brands" yet (it needs the PBS original-brand marker).
- **Mounjaro on EMBOLD.** "Incretins (GLP-1 or GIP drugs)" now covers tirzepatide (PBS A10BX16) as well as the
  GLP-1 drugs: the word "GIP" pre-fills it (`groupWords` in `../RAYDAR medicine extras.json`). Before, EMBOLD
  showed Mounjaro as not on the list. It stays RAYDAR's reading until TST confirms the item in the study admin.
- **Frequency** in the med log, after Dosage, for medications and supplements: common choices as you type (Tab
  fills), anything can be typed. On logged items, the PDF, the Dr enquiry text, and back with Import callback.
- **Enter on a name suggestion only fills the name.** In 2.9 it also added the row at once, before dosage and
  frequency could be filled in. A key a box has used (Enter or Tab on a suggestion) no longer also reaches the
  page's own shortcuts (`App.jsx`).
- **Test mode** (`src/views/TestMode.jsx`), in all three files: "Explore in test mode" on the Identity screen or
  Tools. Skips the identity, date and study-information checks; any study opens straight at its questions; any
  section can be opened; "Show questions hidden by earlier answers" (on to start) shows questions earlier answers
  would hide, marked "Hidden in a real call", and never counts them as unanswered. Answers, the med log, matching,
  Dr enquiry and Save PDF still work. A pink banner that stays in view, a pink frame and "Test mode · no
  participant" mark it; PDFs are stamped TEST with names starting `TEST-`, and reopen in test mode; the Dr enquiry
  text starts "TEST MODE"; test calls are never offered by "Back to the last call". "Back to normal mode" starts a
  clean call.
- **Clinibase branding (option A)**: the Clinibase palette (Clinibase Blue for actions and the current step, navy
  text, cool greys; a navy dark mode), Fira Sans built into the file (`src/fonts.css`, works offline), and the
  Clinibase logo (`src/views/Logo.jsx`, the CB circle always in Clinibase Blue) beside RAYDAR in the header, the
  study admin and page 1 of the PDF. Outcome and site colours are unchanged; the Say card keeps Atkinson
  Hyperlegible. Clinibase pink is kept for test mode only.
- New tests: `npm run test:testmode`; `npm run test:suggest` now covers the search and Frequency;
  `npm run test:pdf` checks Frequency comes back; `npm run test:medicines` checks Mounjaro on EMBOLD.

## New in 2.9: medicine name suggestions

- **Suggestions stay open once the whole name is typed.** In the med log (the side panel and the medication
  questions), typing "Metformin" in full used to make the list disappear; it now stays, with Metformin highlighted
  and the names like it underneath (`src/views/Medicines.jsx`).
- **Tab fills the highlighted suggestion** and stays in the name box (with the route, when the medicine only comes
  one way). Once the name is filled, Tab moves on to the next box as usual; Shift+Tab always goes back. A close
  spelling ("Not listed? Type it as heard") is only filled by Tab when it was picked with the arrow keys or the
  mouse, so a name RAYDAR doesn't know is never swapped for another medicine by tabbing past it.
- Enter still fills the highlighted suggestion; on a name already typed in full it adds the row, as before.
- `npm run test:suggest` checks all of this in a browser.

## New in 2.8: the medicines dictionary

- **Recruiters can check a medicine by any name.** `../RAYDAR medicines.json` maps about 11,000 Australian brand names
  and 2,500 active ingredients to their drug groups. It's built from the Australian Medicines Terminology (NCTS) and
  the PBS's ATC codes by `npm run dict:update` (`scripts/tools/medicines-build.mjs`), plus `../RAYDAR medicine
  extras.json` for aliases (US names, nicknames), herbal ingredients and RAYDAR's own groups (vaccines, live vaccines,
  medicinal cannabis, THC). The source files stay outside the repo; see the `raydar-medicines` skill.
- **Left panel, Prohibited list:** searching a brand, ingredient or misspelling shows what it is, the list item it
  falls under for the chosen study, the time window and the eSource wording, with "Add to med log"
  (`src/views/Medicines.jsx`).
- **Med log:** the name box suggests brands and ingredients as you type, fills the route when there's only one, and
  each logged medicine shows what it was recognised as, or "Not recognised, did you mean…".
- **Matching** (`src/medicines/items.js`): a logged medicine matches a list item by ingredient or drug group, then
  the item's form ("oral/injectable" makes a cream a doctor check), time window (from the end date) and allowed doses
  ("atorvastatin up to 20 mg a day") decide Excluded, Doctor check or OK, with the reason. Items RAYDAR can't match by
  medicine (devices, treatments, dose changes) still match on their own words, as before. Conditions only ever show
  "Possible match, check".
- **Study admin, Quick check and lists:** each medication bullet is pre-filled from its wording (medicines named,
  group words, "in the past 30 days", "oral/injectable"; a group in brackets after named drugs is only suggested) and
  TST confirms it. Publishing asks for every item to be confirmed, or "Publish with RAYDAR's reading". Saved as
  `proItems` in `RAYDAR study settings.json` (`src/admin/ProItems.jsx`).
- **Lists for every study** (`src/esource/convert.js`): besides notes titled as prohibited lists, RAYDAR reads
  - medication questions that name a medicine or drug group and whose "yes" answer excludes or needs the doctors
    ("In the last 4 weeks have you taken spironolactone?"), and condition questions ("Do you have glaucoma?"), in their
    own words, shown under "From the questions";
  - bulleted drug lists without a title when the note says the study excludes them, explains such a question, or
    follows the medication log (SB3567's acne medication list).
  Bullets under "Exceptions", "Permitted", "is required", "can be used" or "wouldn't be exclusionary" are left out
  (KT502's required and allowed RA drugs, its permitted non-live vaccines). Hidden questions stay out.
- A studies folder can carry a newer `RAYDAR medicines.json`; RAYDAR uses it when it's at least as new as its own.
- `npm run test:medicines` checks names, spellings, groups and matching without a browser.

## New in 2.8: the study admin and the shared studies folder

- **Three files from the same code** (`npm run build:all`):
  - `RAYDAR_2.8.html` for recruiters. No study admin inside (`build:single`).
  - `RAYDAR_2.8_Admin.html` for TST, team leads and admins. Opens straight into the study admin; it also holds the call screens, to preview drafts (`build:admin`).
  - `RAYDAR_2.8_All-in-one.html`: both, the admin behind Tools › Study admin and an optional PIN (`build:combined`).
  The admin code is left out of the recruiter build at build time (`src/admin/gate.js`).
- **Shared studies folder** (`src/esource/folder.js`, `connect.js`): a Dropbox folder with the same layout as the repo (`Pre-screening eSource JSONs/`, the four `RAYDAR *.json` files, `_drafts/`, `_history/`). Recruiters connect it once from Tools › Studies folder; RAYDAR reads it each time it opens (Chrome asks for one click after a restart) and falls back to the studies built into the file. Publishing a study no longer needs a new RAYDAR file.
- **Study admin** (`src/admin/`):
  - Studies list: search, filter, status (live, draft, paused), Quick check rules, dates; new study, import an eSource file, copy to another site, pause or resume, discard a draft.
  - Question builder: drag blocks in (Yes/No, pick one, tick all, typed answer, date of birth and age, BMI, medication and history logs, recruiter notes, sections, saved blocks), drag to reorder or between sections, edit the spoken wording, hint, answers and their outcomes (saved as the eSource's ✅ ⚠️ 🛑), "only when" conditions picked from lists, formatted notes, age and BMI ranges; undo and redo. Saved as eSource JSON, so TST's tool opens it too.
  - Dates and visits: fixed cohorts (kinds of stay, cohort dates, follow-ups worked out from Day 1, the study-notes sentence required, suggested dates from a sentence) or a rolling schedule with a live visit timeline.
  - Quick check and lists: the rules read from the questions (switch off, add with their eSource wording), prohibited lists (words matched, "not a prohibited list", try a medication), the file check.
  - Preview and publish: run the draft in the real call screens with a made-up participant; what changes for recruiters (and how many reopened callbacks will re-ask); apply to the other site; a note shown once to recruiters; a second check; publish into the folder with a history copy. Change history and roll back.
  - Quick check settings page (conditions, extra rules, rules switched off) and the studies folder page (connect, fill an empty folder from the built-in studies, the all-in-one file's PIN).
- `RAYDAR study settings.json` (repo root): paused studies, protocol numbers for file names (CORSERA's `COR-PAG-26-101` moved here), prohibited-list corrections, notes for recruiters, saved blocks, the PIN.
- `npm run test:admin` runs the admin end to end.

## New in 2.7: the pre-screen PDF and Import callback

- **Save PDF** on Finish makes the same clinic PDF as RAYDAR Combined (`src/pdf/report.js`): page 1 with the protocol number, PID, verdict banner, callback reason, jump-to links, date of birth / sex / BMI, Needs attention and the call notes; then every answered question in full (shaded when it needs attention), the Quick Check details and the study notes. jsPDF is bundled, so it works offline.
- **Four outcomes**, named the way the team files them (`PID-PROTOCOL-Reason.pdf`):
  - Clear to book: `CONTINUE - CLEAR TO BOOK` → `Booked` (or `INCOMPLETE - N QUESTIONS NOT ANSWERED` → `Incomplete` if questions are left).
  - Exclude: `EXCLUDE - DO NOT BOOK` → `Fail_<reason>` (the criteria ticked, the age or BMI range, or the question).
  - Doctor enquiry: hold the booking (`DOCTOR ENQUIRY - HOLD BOOKING UNTIL THE DOCTOR REPLIES`, callback "Doctor enquiry pending" → `Callback_Doctor_enquiry_pending`) or book now (`BOOK NOW, CANCEL IF THE DOCTOR SAYS NO` → `Booked_DrEnquiry`).
  - Save for callback: Combined's reasons (Not a good time, Unsure on dates, Holidays interfere, No available slots, …) → `Callback_<reason>`.
- **Import callback** (Identity screen, or Tools): open a RAYDAR 2.7 PDF and the call carries on: PID, Quick Check, medication and history log, study, dates, answers, notes and call notes come back. Like Combined, the data in the PDF never holds the name, phone, email or date of birth, so the date of birth and the identity check are done again. Questions the eSource has changed since are asked again. PDFs from RAYDAR Combined or Original can't be reopened here (their questions are named differently); RAYDAR says so.
- PIDs keep the case they're typed in (`p123456_1101`).
- **Quick check rules come from the eSource** (`src/esource/qcrules.js`). Each study's own questions are read when it loads: "Have you been diagnosed with a form of diabetes?" answered "No - Exclude" means it recruits type 2 diabetes only; "Have you used any tobacco or vaping products?" answered "Yes - exclude" rules out smokers. Only plain status questions count (not follow-ups, "is that okay?" agreements, tests or treatments). A study is ruled out only when every matching answer excludes; doctor-check answers make it "check". Under each Quick check item, RAYDAR lists the studies it matters to (hover for the eSource question). Tools → Study files lists every rule.
- **`../RAYDAR quick check.json`** lists the conditions Quick check can ask about (a condition shows only when a loaded study has a rule for it), extra rules the questions don't spell out (with the eSource wording), and rules to ignore. Study files flags conditions a study needs that aren't listed yet. Load an edited copy with Tools → Study files to try it, then rebuild.
- **Hide / Show on every panel:** the small chevrons are now bordered buttons that say Hide or Show (highlighted while a panel is hidden).
- **Visit timeline you can scroll:** the Emeritus visit strip was squeezed into the card's width, so long studies (EMBOLD) were a row of overlapping dots. It now scrolls sideways at about a week per 50px ("Weeks"), with Day labels, months and years, each visit as a bar across its window, phone calls on their own lane and away dates shaded; "Whole study" fits it all in. The visits table scrolls with a fixed header.
- **Undo on Finish:** after saving, "Wrong outcome? Change it" goes back to Finish with every answer kept; the corrected PDF is marked as a revision and names the file it replaces. "Start next call" or Discard by mistake: "Back to the last call" on the Identity screen reopens it (this tab only).
- **V175-001 (Melbourne and Sydney)** is a day-visit study with no overnight stay: Day 1 (vaccination) is Monday 30 November, and its follow-up visits (Day 2, 8, 29, 90, 180, 270 and 365, with their windows) are now dated, so away dates are checked against them. It shows as "Next Day 1", not "Next stay".
- **Switching site or study mid-call is safe.** The side panel no longer crashes when the site filter hides the study on screen (that crash blanked the whole app), each part of the screen now shows its own error instead of blanking everything, answers are kept per study for the whole call, and the same study at another site starts with every answer whose question reads the same in both eSource files.

## New in 2.6

- **Question layout:** the spoken question and the recruiter-only information (descriptions and eSource notes, always in full) side by side on top; the answers, a notes box and full-size Previous / Park / Skip to next buttons run across the full width underneath.
- **Locked toolbar, slim header:** the question pane's toolbar (search, view, call script, section tabs, progress and, in the section list, the section title) stays in view under the header while you scroll. Once you scroll down, the header shrinks to one line (participant, study, site and step, Tools, Finish call) and returns to full size at the top.
- **Spoken words** are in a light blue "Say" card in Atkinson Hyperlegible (loaded from Google Fonts; offline, the system font).
- **Notes go with the right question:** TST writes a note straight after the question it explains, so RAYDAR now attaches it to the question before it (2.5 put it on the next one).
- **Date of birth, height and weight** from Quick check are editable on the questions that reconfirm them (cm or ft/in).
- **Bigger header with a site filter:** All, Melbourne or Sydney, then the sites within the city (Melbourne = Emeritus Melbourne + Veritus). It filters every study list and Compare dates, and is remembered in the browser. Pivotable studies can override it with "All sites".
- **Choose a study:** after Quick check, Pre-screen lists the site's studies by fit (number keys start one) instead of picking one.
- **Emeritus visit timelines:** rolling-recruitment studies use the protocol schedules from RAYDAR Original's Visit calculator (`../RAYDAR visit schedules.json`). Enter a screening date and away dates and every visit is mapped; weekends, public holidays (VIC or NSW) and away dates are closed days. Emeritus studies also join Compare dates from that screening date.
- **Call script:** a "Call script" tab before the first section, or beside the question (side panel button, or the S key; Esc closes).
- **Prohibited lists from the eSource:** the bulleted exclusion notes are read into Medications and Conditions lists, shown as TST wrote them. Logged medications are matched by drug name; a match is flagged for the recruiter ("Not a match" dismisses it), never answered.

## New in 2.5: built from the TST eSource files

- **Every study comes from `../Pre-screening eSource JSONs/`** (25 files, 18 studies across Emeritus Melbourne, Emeritus Sydney and Veritus). Questions, scripts, recruiter notes, answer wording and Study Notes are used exactly as written; nothing is retyped.
- **How the eSource is read** (`src/esource/convert.js`):
  - Each eSource page is a section; pages titled "Study Notes" become the Study information tab.
  - An answer's outcome comes from its marker: ✅ continue, ⚠️ doctor check, 🛑/🚫 exclude. Answers without one show in grey, or blue if they open a follow-up.
  - Follow-ups use the eSource's own `visibleIf` conditions (`src/esource/expr.js`), including age and BMI comparisons.
  - Date of birth and BMI questions are answered from Quick check; their ranges also rank studies in Quick check.
  - Medication and history tables become the med log; multi-select, typed answers and notes that appear after certain answers each get their own step.
- **Cohort dates** come from `../RAYDAR cohort dates.json`, read by hand from the Study Notes (EQ, CORSERA, SUN, V175-001). Each cohort keeps the sentence it came from.
- **Tools → Study files** lists every study, loads new or updated eSource files while RAYDAR is open (a same-named file replaces the built-in one until the tab closes), and shows a file check: conditions pointing at questions that don't exist, answers a condition looks for that aren't there, and answers with no outcome marker.
- **To add or update a study for everyone:** put the eSource JSON in `Pre-screening eSource JSONs/`, add any cohort dates to `RAYDAR cohort dates.json`, then run `npm run build:single`.

## New in 2.4

- **Answer transition**: the answered question slides out (100ms) as the next slides in (220ms, 50ms later). The next question is live straight away, so typing ahead never waits on the animation. In the section list, the "ask next" highlight glides to the next row and sections slide.
- **Key 1 = the likely answer**: the suggested answer when RAYDAR has one, otherwise the answer that moves on (eligible, opens no follow-up). The other answers keep their order on 2, 3 and 4. The key-1 badge is filled.
- **Section list shows full questions inline**: cohort dates, away dates, alcohol and the medication and history logs appear in place of "Open full question". Medication and history now keep separate forms (`S.mf` / `S.hf`).
- **Rebindable shortcuts**: Tools → Keyboard shortcuts. Click a key, press the new one (Esc cancels); a taken key swaps. Saved per browser in `localStorage` (`src/engine/keys.js`).
- **Next-step prompts**: when Identity, Quick check, the study pre-questions or the pre-screen is complete, a prompt offers the next step (Enter by default) and the next step in the step bar pulses. The pre-screen no longer jumps to Finish by itself.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ — needs a web server (e.g. `npm run preview`); double-clicking dist/index.html shows a blank page
npm run build:single   # one self-contained file, written to ../RAYDAR_2.8.html — opens by double-click
```

After changing anything in `src/`, run `npm run build:single` again to refresh `RAYDAR_2.8.html` (or `npm run build:all` for all three files).

## Where things live

| Path | What it is |
| --- | --- |
| `src/engine/data.js` | Quick check conditions (studies now come from the eSource files) |
| `src/esource/studies.js` | The study list: built-in eSources, plus files loaded at run time |
| `src/esource/convert.js` | eSource (SurveyJS JSON) → RAYDAR study, and the file check |
| `src/esource/expr.js` | Evaluates the eSource's visibleIf conditions |
| `src/esource/schedule.js` | Emeritus visit timelines from the protocol schedules |
| `src/views/Timeline.jsx` | The visit timeline view |
| `src/pdf/report.js` | 2.7: the pre-screen PDF (layout from RAYDAR Combined), the callback data inside it, and Import callback |
| `src/views/Import.jsx` | 2.7: the Import callback button and the note shown after reopening |
| `scripts/tools/` | Study tools for the skills in `../.claude/skills/`: `npm run study:report`, `study:diff`, `study:check-data` (see `../HOW TO USE THE RAYDAR SKILLS.md`) |
| `scripts/tests/` | `npm run test:studies`, `test:pdf`, `test:offline` (need Playwright) |
| `src/admin/` | 2.8: the study admin (`AdminApp.jsx` shell and studies list, `Builder.jsx`, `Dates.jsx`, `Checks.jsx`, `Publish.jsx`, `QcPage.jsx`; `ws.js` drafts and publishing; `ops.js` eSource editing) |
| `src/esource/folder.js`, `connect.js` | 2.8: the shared studies folder |
| `src/esource/codes.js` | Protocol numbers for file names (and overrides such as CORSERA), and the question fingerprint callbacks use |
| `src/esource/html.js` | Shows Study Notes HTML safely (allow-listed tags and styles only) |
| `src/engine/store.js` | State, eligibility rules and `act()`, generated from 2.2; `commit()` replaces `render()`. 2.4 adds `ansOrder()` and `nextStep()` |
| `src/engine/keys.js` | Keyboard bindings: defaults, rebinding, labels |
| `src/motion/tokens.js` | Every duration and curve, plus the stage-change storyboard |
| `src/motion/components.jsx` | `Expander`, `IconSwap`, `Row`, `Piece`, `Err`, `shake()`, `QSlide` |
| `src/views/NextStep.jsx` | The next-step prompt |
| `src/views/*` | One file per area: header, intake, pre-screen, med log, planner, Dr enquiry, finish, side panel, tools, tooltip |
| `src/styles.css` | 2.2 base styles plus the CSS motion layer (press, hover, expanders) |

## Motion at a glance

- **Answers and question navigation**: a short slide (see the answer storyboard in `tokens.js`) that never holds the next question back. Undo and toggles stay instant (frequency rule). `FREQ` in `store.js` lists them.
- **Stages**: the old stage leaves while the new one's pieces stagger in, 90ms apart.
- **Panels and expanders**: grid rows 0fr → 1fr (250ms open, 190ms closed) with a fade, so content below glides.
- **Lists** (studies, logged meds, form rows, away dates): FLIP reorders, rows rise in and fade out.
- **Toast, tooltip, icon swaps, async Copy button, error shake**: as in the skill's recipes.
- **Reduced motion**: every animation off, fades included; the spinner keeps turning.

In dev, `window.raydar` exposes the store (`raydar.S`, `raydar.act('confirm')`).
