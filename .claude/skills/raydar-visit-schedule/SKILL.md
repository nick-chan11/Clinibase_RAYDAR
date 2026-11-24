---
name: raydar-visit-schedule
description: Add or correct a rolling-recruitment (Emeritus) study's visit schedule in RAYDAR visit schedules.json, from the protocol's schedule of activities or the study notes. Use when an Emeritus study has no visit timeline in RAYDAR, or its visit timeline, windows or screening-to-Day-1 gap is wrong.
---

# Visit schedule for a rolling-recruitment study

Emeritus studies recruit on a rolling basis: Day 1 follows the participant's screening date. RAYDAR maps every visit
from the screening date, closes weekends, the site's public holidays and away dates, and says which Day 1 dates let
the participant attend everything. The schedules live in `RAYDAR visit schedules.json` (repo root); they started as
copies of RAYDAR Original's Visit calculator.

## Source

The protocol's **schedule of activities** (or the study notes' visit list) is the source. Note its version and date in
the schedule's `note`. Never invent a window: if the protocol gives none, write `"win": 0` and say so in `note`.

## Shape

```json
"schedules": {
  "az": {
    "label": "D7260C00015 — EMBOLD Elecoglipron (AZ)",
    "screenMinToD1": 1, "screenMaxToD1": 28,
    "anchor": "Day 1 (first dose)",
    "note": "Protocol CSP v1.0 10 Mar 2026. …",
    "visits": [
      { "name": "Screening", "dayFrom": -28, "dayTo": -1, "type": "clinic" },
      { "name": "Day 1 — Randomisation, first dose", "day": 1, "win": 0, "type": "clinic" },
      { "name": "Phone call, Week 2 (Day 15)", "day": 15, "win": 3, "type": "phone" },
      { "name": "Day 29 — Titration", "day": 29, "win": 3, "type": "clinic" }
    ]
  }
},
"byCode": { "D7260C00015": "az" }
```

- `day`: study day, Day 1 = anchor. A week-numbered visit is usually `7 × week + 1`; follow the protocol's own rule
  and write it in `note`.
- `win`: days either side. Uneven: `win` (before) plus `winAfter` (after).
- `type`: `clinic`, `remote` or `phone`. Phone calls don't need an open day.
- `screenMinToD1` / `screenMaxToD1`: how many days after screening Day 1 can fall.
- `byCode`: map the study's protocol code **and** its short code (as in the eSource file name) to the schedule key.

## Steps

1. Transcribe the schedule into a new key (short, lower case).
2. Map it in `byCode`.
3. `cd raydar-app && npm run study:check-data`. It checks every visit has a day or range, a valid type, and that a
   Day 1 exists. It also warns when public holidays run out within a year; add the next year's VIC and NSW
   holidays under `holidays` when it does.
4. Open RAYDAR (`npm run dev`), start the study, and read the visit timeline with the person: try a screening date and
   an away period, and compare against RAYDAR Original's Visit calculator if the study existed there.
5. Rebuild and test (raydar-release).
