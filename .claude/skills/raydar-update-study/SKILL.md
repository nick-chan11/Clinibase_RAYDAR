---
name: raydar-update-study
description: Update a study in RAYDAR when TST sends a new version of its eSource JSON. Use when an existing eSource file changes (new wording, answers, dates, dosing days, visit lengths) or someone asks "what changed in <study>". Compares old and new, explains the effect on recruiters and saved callbacks, and updates dates if the study notes changed.
---

# Update a study from a new eSource version

eSource files change often (for example V175-001 gained "This appointment is about 5-6 hours" and its screening
visit went from 2 to 3 hours). The risk is missing a change to **dates**, because cohort dates are kept separately in
`RAYDAR cohort dates.json` and don't update themselves.

All commands run from `raydar-app/`.

## 1. Compare

Put the new file over the old one in `Pre-screening eSource JSONs/` (same file name), then compare with the committed
copy:

```bash
npm run study:diff -- git:HEAD "<file name>"
```

Or compare two files: `npm run study:diff -- <old.json> <new.json>`.

## 2. Go through the changes

- **Questions added, removed or reworded**: read them out to the person in plain words. The diff shows only the
  changed part of a sentence.
- **Answers and outcomes changed**: an answer that used to continue and now excludes changes who gets booked. Call it
  out clearly.
- **Shows when** changes: a follow-up may now appear for different people.
- **Study notes, lines marked (dates)**: STOP and run the **raydar-cohort-dates** skill for this study before
  anything else. Never leave old dates in `RAYDAR cohort dates.json` when the notes changed.
- **Quick check rules / age / BMI changes**: these change which studies recruiters are offered.
- **Saved callback PDFs**: questions whose wording or answers changed are asked again when an older callback PDF is
  reopened. Tell the person how many, so the team isn't surprised.

## 3. Check, build, test

```bash
npm run study:report -- "<file name>"
npm run study:check-data
npm run test:studies
```

Then follow **raydar-release** to publish.

## 4. Write the change note

Give the person a short note they can paste to the team, e.g.:

> **V175-001 (Melbourne and Sydney) updated.** The 30 November visit now says it takes about 5-6 hours. Screening is
> now up to 3 hours (was 2). Reopened callbacks will re-ask 1 question.

Quote eSource wording exactly. Keep it to what changes for a recruiter on the phone.
