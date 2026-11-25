# RAYDAR: notes for Claude

RAYDAR is the pre-screening tool Clinibase recruiters use on calls. Recruiters open one self-contained file,
`RAYDAR_<version>.html` (repo root), in Chrome from Dropbox. Since 2.8 the same code also builds
`RAYDAR_<version>_Admin.html` (the study admin, where TST and team leads build and publish studies) and an
all-in-one file. Published studies live in a shared Dropbox "studies folder" with the same layout as this repo. The app's source is in `raydar-app/` (React + Vite); see
`raydar-app/README.md` for how it's built and what's in each folder.

## Where studies come from

- `Pre-screening eSource JSONs/`: TST's eSource exports, one per study per site, named
  `<Site> - <CODE> - pre-screening.json` (Site: `Emeritus Melbourne`, `Emeritus Sydney` or `Veritus`).
- `RAYDAR cohort dates.json`: fixed cohort, stay and follow-up dates, read by hand from the Study Notes.
- `RAYDAR visit schedules.json`: rolling-recruitment (Emeritus) visit schedules and VIC/NSW public holidays.
- `RAYDAR quick check.json`: Quick check conditions, extra rules and corrections.
- `RAYDAR study settings.json`: paused studies, protocol numbers for file names, prohibited-list corrections and
  confirmed prohibited items (`proItems`), notes for recruiters, saved builder blocks.
- `RAYDAR medicines.json`: the medicines dictionary (brand → ingredient → drug group), built by `npm run dict:update`
  from the AMT and PBS files kept outside the repo in `Clinibase RAYDAR/`, plus `RAYDAR medicine extras.json`
  (hand-kept aliases and RAYDAR's own groups). It only recognises names; the eSource decides what's prohibited.
- The studies folder in Dropbox holds the published copies of all of the above (plus `_drafts/` and `_history/`).
  When studies are managed in the study admin, the folder is the live version: copy it into the repo before working
  on the same files here, and back again after, so the two don't drift.
- `RAYDAR Original.html`, `ARCHIVE RAYDAR versions/`: older versions, for reference only.

## Skills for study work

Use these (in `.claude/skills/`) rather than improvising:

- `raydar-add-study`: a new eSource file.
- `raydar-update-study`: a new version of an existing eSource file.
- `raydar-cohort-dates`: reading dates from the study notes.
- `raydar-visit-schedule`: Emeritus rolling schedules.
- `raydar-quick-check`: which conditions rule studies in or out.
- `raydar-esource-report`: writing up eSource problems for TST.
- `raydar-medicines`: the monthly AMT/PBS refresh, and names that aren't recognised.
- `raydar-release`: build, test, ship.

Tools they use, run from `raydar-app/`: `npm run study:report`, `npm run study:diff`, `npm run study:check-data`,
`npm run test:studies`, `npm run test:pdf`, `npm run test:admin`, `npm run test:offline`, `npm run dict:update`,
`npm run test:medicines`.

## Rules

- **The eSource is the source of truth.** Use its wording exactly; never retype, reword or "fix" questions, answers
  or notes in RAYDAR. Problems go back to TST.
- **Never invent dates, windows or rules.** Every date or rule quotes the sentence it came from. When the source
  doesn't say, ask.
- **The AMT and PBS source files stay out of the repo** (licensed and large); only the built dictionary goes in.
- **No participant data in the repo**: no real PIDs, dates of birth, names, phone numbers or saved PDFs. Test PIDs
  look like `p123456_0000`.
- **Design changes get a mockup first.** Show the person mockups and wait for their choice before changing how
  RAYDAR looks or behaves.
- **Branches:** work on the development branch, not `main`. Merge to `main` only when asked.
- Run the tests before saying something works, and report failures with their output.
- Write for recruiters and team leads: plain words, no jargon, in anything they'll see.
