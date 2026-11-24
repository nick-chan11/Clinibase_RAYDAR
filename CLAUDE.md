# RAYDAR: notes for Claude

RAYDAR is the pre-screening tool Clinibase recruiters use on calls. Recruiters open one self-contained file,
`RAYDAR_<version>.html` (repo root), in Chrome from Dropbox. The app's source is in `raydar-app/` (React + Vite); see
`raydar-app/README.md` for how it's built and what's in each folder.

## Where studies come from

- `Pre-screening eSource JSONs/`: TST's eSource exports, one per study per site, named
  `<Site> - <CODE> - pre-screening.json` (Site: `Emeritus Melbourne`, `Emeritus Sydney` or `Veritus`).
- `RAYDAR cohort dates.json`: fixed cohort, stay and follow-up dates, read by hand from the Study Notes.
- `RAYDAR visit schedules.json`: rolling-recruitment (Emeritus) visit schedules and VIC/NSW public holidays.
- `RAYDAR quick check.json`: Quick check conditions, extra rules and corrections.
- `RAYDAR Original.html`, `ARCHIVE RAYDAR versions/`: older versions, for reference only.

## Skills for study work

Use these (in `.claude/skills/`) rather than improvising:

- `raydar-add-study`: a new eSource file.
- `raydar-update-study`: a new version of an existing eSource file.
- `raydar-cohort-dates`: reading dates from the study notes.
- `raydar-visit-schedule`: Emeritus rolling schedules.
- `raydar-quick-check`: which conditions rule studies in or out.
- `raydar-esource-report`: writing up eSource problems for TST.
- `raydar-release`: build, test, ship.

Tools they use, run from `raydar-app/`: `npm run study:report`, `npm run study:diff`, `npm run study:check-data`,
`npm run test:studies`, `npm run test:pdf`, `npm run test:offline`.

## Rules

- **The eSource is the source of truth.** Use its wording exactly; never retype, reword or "fix" questions, answers
  or notes in RAYDAR. Problems go back to TST.
- **Never invent dates, windows or rules.** Every date or rule quotes the sentence it came from. When the source
  doesn't say, ask.
- **No participant data in the repo**: no real PIDs, dates of birth, names, phone numbers or saved PDFs. Test PIDs
  look like `p123456_0000`.
- **Design changes get a mockup first.** Show the person mockups and wait for their choice before changing how
  RAYDAR looks or behaves.
- **Branches:** work on the development branch, not `main`. Merge to `main` only when asked.
- Run the tests before saying something works, and report failures with their output.
- Write for recruiters and team leads: plain words, no jargon, in anything they'll see.
