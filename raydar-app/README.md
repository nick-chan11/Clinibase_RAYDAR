# RAYDAR 2.7 (React + Motion)

A component-based port of `RAYDAR_2.2.html`, built to use the full charles-ux-animation skill.

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
npm run build:single   # one self-contained file, written to ../RAYDAR_2.7.html — opens by double-click
```

After changing anything in `src/`, run `npm run build:single` again to refresh `RAYDAR_2.7.html`.

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
