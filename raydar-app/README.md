# RAYDAR 2.6 (React + Motion)

A component-based port of `RAYDAR_2.2.html`, built to use the full charles-ux-animation skill.

## New in 2.6

- **Question layout (1B):** the spoken question and the answers on the left, the recruiter-only information (descriptions and eSource notes) beside them. A notes box sits under every question's answers, and Previous / Skip to next are full-size buttons.
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
npm run build:single   # one self-contained file, written to ../RAYDAR_2.6.html — opens by double-click
```

After changing anything in `src/`, run `npm run build:single` again to refresh `RAYDAR_2.6.html`.

## Where things live

| Path | What it is |
| --- | --- |
| `src/engine/data.js` | Quick check conditions (studies now come from the eSource files) |
| `src/esource/studies.js` | The study list: built-in eSources, plus files loaded at run time |
| `src/esource/convert.js` | eSource (SurveyJS JSON) → RAYDAR study, and the file check |
| `src/esource/expr.js` | Evaluates the eSource's visibleIf conditions |
| `src/esource/schedule.js` | Emeritus visit timelines from the protocol schedules |
| `src/views/Timeline.jsx` | The visit timeline view |
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
