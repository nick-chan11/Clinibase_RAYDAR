# RAYDAR pipeline

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
- Each row shows the name, brand or ingredient, its drug group, and its result for the chosen study: Excluded,
  Doctor check or Not on the list (the same `checkMed()` the full card uses).
- Drug group line: the broad class in plain words, then the exact class, both from the ATC levels already in
  `RAYDAR medicines.json` ("Antipsychotics · Diazepines, oxazepines, thiazepines and oxepines", "Drugs used in
  diabetes · Biguanides"). The mockup's "Antipsychotic", "(diabetes)" and "Statin" labels were illustrative;
  everyday names like "statin" or "SSRI" would need adding by hand to `RAYDAR medicine extras.json`.
  To confirm: broad + exact class, or broad class only.
- Third line, only when it's on the list: the list item it falls under and its time window.
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
