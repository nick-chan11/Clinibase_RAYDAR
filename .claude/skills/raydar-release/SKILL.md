---
name: raydar-release
description: Build, test and ship a RAYDAR version (the single RAYDAR_<version>.html file recruiters open). Use after adding or updating studies or changing the app, when someone asks to "build", "release", "publish", "ship" RAYDAR, or to get a file ready for Dropbox.
---

# Release RAYDAR

Recruiters use one self-contained file, `RAYDAR_<version>.html` in the repo root, opened in Chrome from Dropbox. It
works offline: studies, dates and the PDF maker are built into it, and since 2.8 it reads newer studies from the
shared studies folder when one is connected. `npm run build:all` also builds `RAYDAR_<version>_Admin.html` (the
study admin) and `RAYDAR_<version>_All-in-one.html`.

All commands run from `raydar-app/`.

## 1. Version

- A study or data change on its own: keep the version, rebuild.
- App changes: bump `version` in `package.json` (e.g. 2.7.0 → 2.8.0), the `RAYDAR_VERSION` text in
  `src/engine/store.js`, the header number in `src/views/Header.jsx`, `BUILD` in `src/pdf/report.js`, the title in
  `index.html`, and the title set in `src/admin/AdminApp.jsx`. Add a "New in <version>" section at the top of
  `raydar-app/README.md`.

## 2. Check and test

```bash
npm run study:check-data
npm run test:studies
npm run test:pdf
npm run test:admin
npm run test:medicines
npm run test:suggest
npm run test:testmode
npm run test:scroll
npm run test:details
npm run build:all
npm run test:offline
```

- `study:check-data`: cohort dates, visit schedules and Quick check settings are valid.
- `test:studies`: every study is answered start to finish by keyboard, as a woman and as a man.
- `test:pdf`: a PDF is saved for every Finish outcome and reopened with Import callback.
- `test:admin`: the study admin end to end (set up a folder, drag in a question, publish, preview).
- `test:medicines`: names, spellings, groups and prohibited-item matching.
- `test:suggest`: the med log name and Frequency suggestions, and the prohibited-list search.
- `test:testmode`: test mode on and off, free movement, the TEST-stamped PDF.
- `test:scroll`: the header slides without the page jumping.
- `test:details`: participant details never saved; Travel opens Google Maps to the right place.
- `build:all` writes `../RAYDAR_<version>.html`, `_Admin.html` and `_All-in-one.html`.
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

- A study change published from the study admin needs no release at all: recruiters get it from the studies folder.
- The files to drop in Dropbox: `RAYDAR_<version>.html` for recruiters, `RAYDAR_<version>_Admin.html` in a folder only
  admins can open (or the all-in-one file, if the team chose one file). Chrome is recommended: it can remember the
  studies folder. The files work offline, but icons and the reading font load from the internet when available.
- A short "what's new" note for the team lead, in recruiter terms (what they'll notice on a call), plus any study
  changes and anything sent back to TST.
- Reminders: recruiters should open the new file, not an old copy. Callback PDFs saved by an older version may re-ask
  questions that changed.
