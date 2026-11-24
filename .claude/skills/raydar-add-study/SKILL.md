---
name: raydar-add-study
description: Add a new study to RAYDAR from a TST eSource JSON export. Use when someone has a new pre-screening eSource file (or asks to "add", "load" or "set up" a study in RAYDAR), before it reaches recruiters. Checks the file, reports what RAYDAR will make of it, sets up its dates, builds and tests.
---

# Add a new study to RAYDAR

RAYDAR reads studies straight from TST's eSource JSON files. Questions, scripts, answers and notes are used exactly as
TST wrote them: **never retype or "fix" eSource wording in RAYDAR**. If the wording is wrong, it goes back to TST
(raydar-esource-report skill).

All commands run from `raydar-app/`.

## 1. Put the file in place

- The file goes in `Pre-screening eSource JSONs/`.
- Its name must be `<Site> - <CODE> - pre-screening.json`, where Site is exactly `Emeritus Melbourne`,
  `Emeritus Sydney` or `Veritus`. The name is how RAYDAR knows the site. CODE is the short code recruiters say
  (e.g. `SRSD`, `V175-001`, `CORSERA`).
- The same study at two sites is two files (e.g. `Emeritus Melbourne - OLX - …` and `Emeritus Sydney - OLX - …`).
- The file the person gives you may contain nothing private, but never put participant data in the repo.

## 2. Report on it

```bash
npm run study:report -- "<file name or a unique part of it>"
```

Read the whole report and go through it with the person:

- **Protocol code**: this is what PDFs and file names use. It comes from the first word of the eSource title. If the
  team files PDFs under a different number (CORSERA → `COR-PAG-26-101`), add it to `PROTO_OVERRIDE` in
  `raydar-app/src/esource/codes.js`.
- **Age and BMI range**: if "none found", RAYDAR's Quick check won't check age or BMI for this study. Look at the date
  of birth question's conditions; if the eSource states the range only in text, tell the person (TST can add a
  condition, which is the reliable fix).
- **Quick check rules**: check each one reads correctly against the question it quotes. Wrong ones go in the
  `ignore` list (raydar-quick-check skill). "Needs X, which Quick check doesn't ask about" → raydar-quick-check skill.
- **Answers without an outcome marker**: RAYDAR shows them grey and can't suggest them. Usually a TST fix.
- **File check**: anything under "Fix before publishing" makes a question never show. Report it to TST before
  going live (raydar-esource-report skill).
- **Prohibited lists**: make sure every list came from a real exclusion note. Holiday or travel information was once
  misread as a prohibited list; if that happens, tell the person and fix the stop words in
  `raydar-app/src/esource/convert.js` (`extractPro`), then re-run the report.

## 3. Dates

The report says which applies:

- **Veritus / fixed cohorts** (study notes give stay dates): use the **raydar-cohort-dates** skill.
- **Emeritus / rolling recruitment** (Day 1 follows screening): use the **raydar-visit-schedule** skill if the report
  says there's no schedule.
- **No dates**: fine if the study notes really give none. Say so to the person.

## 4. Check the data, build and test

Follow the **raydar-release** skill. At minimum:

```bash
npm run study:check-data
npm run test:studies
npm run build:single
```

`test:studies` must show the new study reaching Finish as a woman and as a man.

## 5. Tell the person

Summarise in plain words: the study code and site, protocol code, question count, age/BMI, Quick check rules, dates,
anything sent back to TST, and that it still needs publishing (raydar-release). Keep the eSource wording quoted, never
paraphrased.
