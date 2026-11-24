---
name: raydar-cohort-dates
description: Read cohort, stay, dosing and follow-up dates from a study's eSource Study Notes into RAYDAR cohort dates.json. Use when a study with fixed dates is added, when its study notes change, or when dates in RAYDAR look wrong (wrong stay length, a day visit shown as an overnight stay, missing follow-ups).
---

# Cohort dates from the study notes

`RAYDAR cohort dates.json` (repo root) holds the dates RAYDAR uses for fixed-date studies: Compare dates, away-date
clashes, the "Next stay" / "Next Day 1" in Pivotable studies and the dates step before questions. They are read **by
hand** from the eSource Study Notes, so accuracy rules matter more than speed.

## Golden rules

1. **Never invent a date.** Every date must come from a sentence in the study notes (or the protocol schedule the
   notes quote). If you can't tell (e.g. which study day a date is), **ask the person**. Do not guess.
2. **Every cohort keeps its source sentence** in `src`, copied exactly.
3. **A day-visit study is never an overnight stay.** If the notes say an appointment of some hours, `nights: 0` and
   `in` = `out`. (V175-001 was once recorded as a stay; it's a Day 1 vaccination visit.)
4. **Years aren't written in the notes.** Late November–December is the current year; January onward is next year;
   follow-ups run on from there. Check against today's date and say which year you chose.
5. **"[FILLED]"** (or full / closed) on a cohort → `"closed": true`. Keep it; recruiters see it greyed out.
6. Telehealth / phone calls don't need a clinic day: leave them out of `v`, and mention them in the type's `fu` text.

## Steps

1. Find the date sentences:
   ```bash
   cd raydar-app && npm run study:report -- "<file name>"
   ```
   The "Date sentences in the study notes" section lists them. Read the full study notes too (the converter's
   `s.notes`), since dates sometimes sit in a table.
2. Work out each cohort: check-in (or Day 1), check-out, nights, and each follow-up with its window.
   - "Day N" counts from Day 1: **Day N = Day 1 + (N − 1) days**. "Day -1" is the day before Day 1 (admission).
   - "(± 2 days)" → `"w": 2`. "+/- 1 week" → `"w": 7`. "+/- 2 weeks" → `"w": 14`. An uneven window
     (e.g. "6 to 1 days before admission") → `"a"` and `"b"` dates instead of `"w"`.
3. Write the entry (keyed by the exact eSource file name; copy the formatting of existing entries, one cohort per
   line group, so diffs stay readable). Shape:
   ```json
   "Veritus - EQ - pre-screening.json": {
     "types": {
       "mad": { "l": "MAD", "nights": 13, "stay": "13 nights, Day -1 to Day 13…", "fu": "Day 17 (±1 day)", "pay": "$8,400", "alt": "$900", "note": "…" }
     },
     "cohorts": [
       { "id": "m6g2", "n": "MAD 6 Group 2", "t": "mad", "in": "2026-12-06", "out": "2026-12-19",
         "v": [{ "d": "2026-12-23", "w": 1, "l": "Follow-up (Day 17)" }],
         "src": "MAD 6 Group 2. Your in-clinic stay will be from the 6th - 19th of December. You would then return…" }
     ]
   }
   ```
   A day-visit study: `"nights": 0`, `"in"` = `"out"` = Day 1, follow-ups in `v`.
   The same study at two sites gets two entries (one per file).
4. Check:
   ```bash
   cd raydar-app && npm run study:check-data
   ```
   It catches impossible dates, nights that don't match the stay, day visits with different in/out dates, follow-ups
   before Day 1, missing `src`.
5. Show the person a table of what you wrote (cohort, Day 1/stay, each visit date and window) next to the sentence it
   came from, and anything you had to ask or assume. Then rebuild (raydar-release).

## When the notes and an older RAYDAR disagree

Older RAYDAR versions (Original, Combined) may hold different dates (V175-001 had 30 Nov **or** 7 Dec in Combined; the
current eSource says 30 Nov). **The current eSource wins.** Tell the person about the difference and let them decide.
