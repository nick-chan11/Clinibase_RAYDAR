# RAYDAR pipeline

**RAYDAR 2.10 is built** (search S1, test mode T1, branding A, Frequency, the Mounjaro fix); see "New in 2.10" in
`README.md`. Still to do:
- **Common brands** tag: left out of 2.10. Needs the PBS original-brand ("innovator") marker read by `dict:update`
  (one more PBS file) and a short hand-kept list for pharmacy brands.
- **TST to confirm** EMBOLD's "Incretins (GLP-1 or GIP drugs)" item in the study admin (it now includes
  tirzepatide as RAYDAR's reading).
- **For TST** (`raydar-esource-report`): D7261C00005 and SELENE 1 list "Semaglutide (Ozempic, Mounjaro)", but
  Mounjaro is tirzepatide.
- Dark mode: some eSource notes carry their own dark text colour ("These include the following:" in EMBOLD's
  prohibited list), which is hard to read on dark backgrounds. Already the case in 2.9.

## Found while mocking up: Mounjaro isn't caught on EMBOLD (fix in 2.10, to confirm)

EMBOLD (D7260C00015) excludes "Incretins (GLP-1 or GIP drugs)" within 90 days. `checkMed` matches semaglutide
(Ozempic, Wegovy, Rybelsus) but returns nothing for tirzepatide (Mounjaro): the PBS files it under A10BX
"Other blood glucose lowering drugs", not A10BJ GLP-1 analogues. Fix through the `raydar-medicines` skill: add
tirzepatide to that item's `proItems` for TST to confirm (or a RAYDAR incretins group covering A10BJ and
tirzepatide), then check every study with an incretin or GLP-1 item, and add a `test:medicines` check.

## Frequency in the med log (2.10)

- A Frequency box after Dosage for medications and supplements (not history): `FLD` and `EF()` in
  `src/engine/store.js`, `eParts`/`eText`, the edit actions (`redit`, `medit`), the med log form and logged rows.
- Suggests Once daily, Twice daily, Three times daily, Four times daily, Every morning, At night, Weekly,
  Fortnightly, Monthly, As needed (a datalist or the 2.9 suggestion box with Tab); any text allowed.
- Dosage's example becomes "500 mg" (frequency no longer in it).
- Saved in the PDF and the Dr enquiry text; Import callback reads it, and older PDFs without it still import.
- Tests: `test:pdf` round-trips a frequency; `test:suggest` covers Tab on the frequency box.

Improvements queued for the next version. Nothing here is built yet: each waits for a go-ahead, and anything that
changes how RAYDAR looks or behaves waits for a mockup choice first (see the mockups page linked in the session).

## 1. Prohibited-list search suggests as you type

Where: left panel, Prohibited list, Medications search (`MedLookup` in `src/views/Medicines.jsx`).

Problem today: the search only recognises a name once it's typed in full. "metformi" or "quetiap" says
"isn't a medicine RAYDAR knows", which reads as if the medicine doesn't exist. "insulin" says the same, though
there are 15 insulins in the dictionary.

Plan:
- From 3 letters, list the medicines whose name starts with what's typed (brands and ingredients, the same
  `suggest()` the med log uses), nearest first, scrolling after the first 6.
- No route tag ("Taken"): the med log already asks for the route.
- Each row shows the name, brand or ingredient, its drug group, and its result for the chosen study: Excluded,
  Doctor check or Not on the list (the same `checkMed()` the full card uses).
- Drug group line: the broad class in plain words, then the exact class, both from the ATC levels already in
  `RAYDAR medicines.json` ("Antipsychotics · Diazepines, oxazepines, thiazepines and oxepines", "Drugs used in
  diabetes · Biguanides"). The mockup's "Antipsychotic", "(diabetes)" and "Statin" labels were illustrative;
  everyday names like "statin" or "SSRI" would need adding by hand to `RAYDAR medicine extras.json`.
  To confirm: broad + exact class, or broad class only.
- Third line, only when it's on the list: the list item it falls under and its time window.
- Round 2 (chosen S1): the highlighted suggestion opens with labelled tags. Ingredient: Drug class, Common
  brands (+N more), Taken. Brand: Active ingredient(s), Drug class (one per ingredient for combinations), Taken,
  Same as (other brands of the same medicine). Close spellings sit under their own heading.
- Common brands need a source: read the PBS original-brand ("innovator") marker in `dict:update` (one more PBS
  file) and a short hand-kept list in `RAYDAR medicine extras.json`. Everyday class names ("pain and fever
  relief", "GIP and GLP-1 drugs") come from a short list the team approves, where the PBS wording is clinical.
- Click, Enter or Tab opens the full card that shows today when a name is recognised (eSource wording, time
  window, Add to med log). Arrow keys move through the rows. Typing the full name keeps the list (as in 2.9's med log).
- No name starts with it, but there are close spellings ("atorvastaten"): "No medicine starts with that.
  Closest spellings:" and the rows. No "doesn't know" wording.
- "RAYDAR doesn't recognise …" only when there's no name starting with it and no close spelling.
- The list's own words are still searched underneath, as now.
- Test: extend `scripts/tests/suggest.mjs` (metformi, insulin, quetiap, atorvastaten, a made-up name).

Mockup choice needed: suggestions inside the panel with each study result (recommended) or a drop-down under
the box like the med log.

## 2. Test mode

For recruiters learning a study and for testing RAYDAR: move freely through any study without the call's checks.

Plan:
- Switched on from the Identity screen ("Explore in test mode") and Tools; switched off with "Back to normal
  mode", which starts a clean call.
- Skips: identity (PID, date of birth, profile match), Quick check, dates and availability, the study
  information check. Any study opens straight at its questions.
- Free movement: every section and question can be opened in any order; an option shows questions that earlier
  answers would hide, marked as hidden.
- Everything else still works so it can be tested: answers and outcomes, the med log, prohibited-list matching,
  Dr enquiry, Finish and Save PDF.
- Can't be mistaken for a real call: a pink banner that stays at the top ("Don't enter a real participant's
  details. Switch back to normal mode before a real call."), "Test mode · no participant" in the header, a pink
  frame around the page (mockup option), PDFs stamped "TEST, not a real pre-screen" with file names starting
  `TEST-`, and test calls never offered by "Back to the last call".
- Test: a new `scripts/tests/testmode.mjs` (switch on, open a study, jump to the last section, answer, save a
  PDF and check the stamp and name, switch off and check a normal call starts clean).

Questions for the person: should the recruiter file have test mode, or only the admin and all-in-one files?
Should the hidden-questions option be on by default?

## 3. Clinibase branding

From `Clinibase Branding/Clinibase brand guidelines v2.0 Jul 2024.pdf`: Clinibase Blue `#00AFF5` (shades
allowed), white, greys `#F2F3F4`, navy `#1b2a3f` / `#0d3060`, pink `#DD0881` as a sparing accent; Fira Sans
(Montserrat for web, Arial as a fallback); the logo on white or Clinibase Blue, with clear space, the CB circle
always in Clinibase Blue.

Plan (after a mockup choice: A clean, B navy header or C brand blue):
- Replace the colour settings at the top of `src/styles.css` (light and dark) with the Clinibase palette.
  Status colours (green, amber, red) and site colours stay as they are.
- Clinibase Blue is too light for white text (2.5:1), so buttons use a deeper shade (`#0077B6`, 4.9:1) or navy
  text on Clinibase Blue (5.9:1). Text and links use `#00669C` on light and `#5FD0FB` on dark.
- Fira Sans for the app, bundled into the file so it works offline. Keep Atkinson Hyperlegible for the Say card
  (to confirm).
- The Clinibase logo (from `Logos Red Bilby/Edited Clinibase logo/CLINIBASE LOGO BW.svg`, coloured to the
  guidelines) beside RAYDAR in the header, the PDF and the admin.
- Pink is kept for test mode only.
- Run every test and check light and dark at 1280px and 1440px before release.

## RAYDAR 2.11 (mockups: `mockups/2026-11 RAYDAR 2.11/`, https://claude.ai/artifact/DeuBFuAr79LqjeLjViBLJy)

Waiting on the choices at the end of the mockups page.

1. **Test mode keeps dates and study information.** A study opens on its visit timeline and study information (as in
   a real call), with "Go to questions" always available and "Dates and study info" on the questions toolbar.
   Nothing has to be confirmed.
2. **Participant details and travel time.** Identity gets Full name, Phone, Email and Postcode (optional). Name,
   phone and email stay on screen only (never in the PDF, callback file or Dr enquiry; cleared at the end of the
   call). With a postcode: "Travel" in the header, an optional Quick check row (OK / Too far, never a rule), a
   Travel link per study in Pivotable studies, and a button on the question that names the study's location.
   - Option G1: open Google Maps directions (postcode → the study's address) in a separate window, by car or public
     transport. No key, no cost, no install.
   - Option G2: show the colleague's Commute Finder times inside RAYDAR. Needs the extension on each computer
     (with "Allow access to file URLs") and a small addition to the extension so RAYDAR can ask it.
   - The Commute Finder (Chrome extension, v1.0.9) holds two Google Maps keys in its files. They must not go into
     RAYDAR or this repo. Suggest restricting them in Google Cloud.
   - Addresses: the study's eSource address where given (EMBOLD, SB3567 MEL: 1096 Toorak Rd Camberwell; D7261C00005,
     GSBR-1290-12, SB3567 SYD, SELENE 1: 12 Lord St Botany; SELENE 2: 84 Pitt St Sydney; SRSD: 22 Mons Rd Westmead).
     A default per site is needed for the rest (all Veritus studies have none), settable per study in the admin.
3. **Check a list of medicines** in the Prohibited list panel ("Search one | Check a list"): one name per line,
   instruction to write names first; spelling fixed (e.g. "metfor,in" → Metformin); choices with "None of these"
   when unsure (e.g. panadol, sertaline); not-recognised lines kept as typed; each checked against the chosen study;
   "Add all to the med log" (text after the name goes to Dosage/Frequency).
4. **Header and scrolling.** Cause measured: going slim removes ~106 px from the header, which sits in the page's
   flow, so on short pages the page shrinks, the scroll position is clamped (-106 px), then the side panel grows
   into the space (+106 px): the jump/glitch at the bottom. Fix: the header floats (fixed, with a constant spacer),
   so its size never changes the page's height, and it slides between full and slim (~200 ms, none with reduced
   motion); the side panel's height doesn't depend on the header's.
