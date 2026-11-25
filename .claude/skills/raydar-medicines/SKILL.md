---
name: raydar-medicines
description: Keep RAYDAR's medicines dictionary up to date and correct how a medicine name is recognised. Use for the monthly AMT/PBS refresh ("update the medicines dictionary"), when a recruiter's medicine name isn't recognised or matches the wrong thing, when a brand, nickname or herbal medicine needs adding, or when a prohibited-list item matches too much or too little.
---

# Medicines dictionary

RAYDAR recognises medicine names (brands, ingredients, close spellings) with `RAYDAR medicines.json` (repo root,
built into every RAYDAR file). It **only recognises names**: it never makes anything prohibited. What a study
prohibits comes from its eSource, structured per item in the study admin (Quick check and lists tab), saved as
`studies[file].proItems` in `RAYDAR study settings.json`.

How it's built (`raydar-app/scripts/tools/medicines-build.mjs`):

| Source | What it gives | Where it lives |
|---|---|---|
| `amt-YYYYMMDD.csv` (NCTS, AMT flat file) | every Australian product: brand → active ingredient, strength, form | outside the repo (licensed, 24 MB) |
| `amt-items.csv` (PBS) | PBS item → AMT ids | outside the repo |
| `item-atc-relationships.csv` (PBS) | PBS item → ATC drug-group code | outside the repo |
| `atc-codes.csv` (PBS) | ATC code → group name, level, parent | outside the repo |
| `RAYDAR medicine extras.json` | hand-kept: aliases, herbal ingredients, RAYDAR's own groups, live-vaccine corrections, group words | repo root |

By default the build reads the four source files from the folder that holds the repo (`Clinibase RAYDAR/`).
Never copy them into the repo.

## Monthly refresh

1. Download the new AMT flat file from NCTS (healthterminologies.gov.au, Clinibase account) and the three PBS files
   from the same PBS schedule month. Put them in `Clinibase RAYDAR/` (replace the old PBS files; keep one AMT file).
2. From `raydar-app/`: `npm run dict:update`. Read the report:
   - a warning that the PBS files come from different schedules → download them again from one month;
   - names added or removed, ingredients that changed group: check any that appear on a live study's list
     (`npm run study:report` lists them);
   - "To fix in RAYDAR medicine extras.json" lines → fix them.
3. `npm run test:medicines`, then the release skill (`raydar-release`) to rebuild and test the RAYDAR files.
4. If the studies folder is in use, copy the new `RAYDAR medicines.json` into it too: a RAYDAR file uses the folder's
   copy only when it's at least as new as its own.

## A name isn't recognised, or is recognised wrongly

Add a line to `RAYDAR medicine extras.json`, with who and when. Then run `npm run dict:update` and the tests.

- Another name for an AMT ingredient (US name, nickname, short name):
  `{ "name": "blue puffer", "to": ["salbutamol"], "why": "nickname", "by": "<name>", "date": "<YYYY-MM-DD>" }` in
  `aliases`. `to` must be an ingredient name exactly as the dictionary has it (the build says if it isn't).
- A medicine AMT doesn't have (often herbal): `{ "name": "st john's wort", "groups": ["x-herbal"], "by": …, "date": … }`
  in `ingredients`.
- A live-vaccine correction goes in `liveVaccines`, marked `"review": "needs a doctor to confirm"` until a doctor has.

Never add an alias that changes what a medicine *is* to make a study match. If a prohibited item matches too much or
too little, fix the item in the study admin, not the dictionary.

## Where a study's list comes from

RAYDAR reads prohibited items from (`raydar-app/src/esource/convert.js`): notes titled as a prohibited list;
medication and condition questions whose "yes" answer excludes or needs the doctors (when they name a medicine,
group or condition); and untitled drug lists that say the study excludes them, explain such a question, or follow the
medication log. Lists of what's required, allowed, accepted or an exception are left out. If a study still shows no
list, its exclusions are only in wording RAYDAR can't read: raise it with TST (`raydar-esource-report`).

## A prohibited item matches too much or too little

That's the item, not the dictionary. In the study admin (the study → Quick check and lists → Prohibited lists):
remove or add medicines and groups, set the outcome, time window, forms and allowed doses, use "Test it", and
confirm. A group in brackets after named drugs ("Diltiazem, Verapamil (calcium channel blockers)") is only offered
as a suggestion: add it only if the eSource prohibits the whole group. Wording problems in the eSource itself go
back to TST (`raydar-esource-report`).

`groupWords` in the extras file only pre-fills items (e.g. "statins" → C10AA). Adding a word there changes the
pre-fill for every study, so check `npm run test:medicines` and the admin afterwards.

## Rules

- Quote sources; never invent a group's members. Use ATC (from the PBS files) or the eSource's own list.
- Conditions are only ever a "possible match, check". Don't make them decide anything.
- No participant data in any of these files.
