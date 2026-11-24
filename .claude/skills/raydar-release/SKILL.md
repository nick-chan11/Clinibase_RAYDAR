---
name: raydar-release
description: Build, test and ship a RAYDAR version (the single RAYDAR_<version>.html file recruiters open). Use after adding or updating studies or changing the app, when someone asks to "build", "release", "publish", "ship" RAYDAR, or to get a file ready for Dropbox.
---

# Release RAYDAR

Recruiters use one self-contained file, `RAYDAR_<version>.html` in the repo root, opened in Chrome from Dropbox. It
works offline: studies, dates and the PDF maker are built into it.

All commands run from `raydar-app/`.

## 1. Version

- A study or data change on its own: keep the version, rebuild.
- App changes: bump `version` in `package.json` (e.g. 2.7.0 → 2.8.0), the `RAYDAR_VERSION` text in
  `src/engine/store.js`, the header number in `src/views/Header.jsx`, `BUILD` in `src/pdf/report.js`, the title in
  `index.html`, and the target in `scripts/copy-single.mjs`. Add a "New in <version>" section at the top of
  `raydar-app/README.md`.

## 2. Check and test

```bash
npm run study:check-data
npm run test:studies
npm run test:pdf
npm run build:single
npm run test:offline
```

- `study:check-data`: cohort dates, visit schedules and Quick check settings are valid.
- `test:studies`: every study is answered start to finish by keyboard, as a woman and as a man.
- `test:pdf`: a PDF is saved for every Finish outcome and reopened with Import callback.
- `build:single` writes `../RAYDAR_<version>.html`.
- `test:offline`: the built file works with the network off.

All must pass. The tests need Playwright (see `HOW TO USE THE RAYDAR SKILLS.md`). Report failures with their output;
never skip a failing test.

## 3. Privacy check before committing

- No participant data in the repo: no real PIDs, dates of birth, names, or sample PDFs. Test PIDs look like
  `p123456_0000`.
- `git status` should show only the files you meant to change.

## 4. Commit and push

Commit on the development branch the team uses (not `main`), with a message saying what changed for recruiters.
Push, and only merge to `main` when the person asks.

## 5. Hand-over

Give the person:

- The file to drop in Dropbox: `RAYDAR_<version>.html` (one file; Chrome recommended; it works offline, but icons and
  the reading font load from the internet when available).
- A short "what's new" note for the team lead, in recruiter terms (what they'll notice on a call), plus any study
  changes and anything sent back to TST.
- Reminders: recruiters should open the new file, not an old copy. Callback PDFs saved by an older version may re-ask
  questions that changed.
