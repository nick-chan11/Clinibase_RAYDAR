# How to use the RAYDAR skills

The RAYDAR skills are step-by-step instructions that Claude follows for the study jobs we do over and over: adding
a study, updating one when TST change the eSource, reading dates from the study notes, building and shipping a new
RAYDAR file. They live in this repo (`.claude/skills/`), so anyone who opens the repo in Claude Code gets them, and
every study is done the same careful way.

## What you need (once)

1. **Claude Code**: the desktop app, the terminal version, or claude.ai/code in a browser. Sign in with your
   Claude account.
2. **This repo** on your computer (or opened in claude.ai/code from GitHub).
3. **Node.js 20 or newer**, then in `raydar-app/` run `npm install`.
4. **For the tests only:** Playwright, once:
   ```bash
   cd raydar-app
   npm install --no-save playwright
   npx playwright install chromium
   ```

## Using a skill

Open the repo in Claude Code and either:

- **Just ask in plain words.** Claude picks the right skill, for example:
  - "TST sent a new eSource for KT502, it's in the eSource folder. Add it to RAYDAR."
  - "The V175 eSource changed, what's different?"
  - "Read the cohort dates for EQ from its study notes."
  - "Build and test a new RAYDAR file for Dropbox."
- **Or type the skill's name** with a slash: `/raydar-add-study`, `/raydar-update-study`, and so on.

Claude explains what it found and asks before anything it can't be sure of (a date the notes don't pin down, a rule
that looks wrong).

## The skills

| Skill | Use it when | What you get |
|---|---|---|
| `raydar-add-study` | TST send a new eSource file | A report on the study (questions, age/BMI, Quick check rules, problems), dates set up, a tested build |
| `raydar-update-study` | TST change an existing eSource | What changed in plain words, what it means for recruiters and saved callbacks, dates re-read if the notes changed, a change note for the team |
| `raydar-cohort-dates` | A study has fixed dates, or its dates look wrong | Dates read from the study notes, each with the sentence it came from, checked for mistakes |
| `raydar-visit-schedule` | An Emeritus (rolling) study has no visit timeline, or a wrong one | The protocol's visit schedule added, so RAYDAR maps every visit from the screening date |
| `raydar-quick-check` | Quick check offers a study it shouldn't, or misses one | The rules checked against the eSource questions, and corrected |
| `raydar-esource-report` | You want to tell TST what's wrong in their files | A message ready to paste, sorted by impact |
| `raydar-release` | Time to give recruiters a new RAYDAR file | All checks and tests run, the file built, a "what's new" note for the team lead |

## The tools the skills use

You can also run these yourself, from `raydar-app/`:

| Command | What it does |
|---|---|
| `npm run study:report -- "SRSD"` | What RAYDAR will make of an eSource file (or `-- --all` for every study) |
| `npm run study:diff -- git:HEAD "Emeritus Sydney - V175-001 - pre-screening.json"` | What changed in an eSource since it was last saved in the repo |
| `npm run study:check-data` | Checks the dates, visit schedules and Quick check files for mistakes |
| `npm run test:studies` | Answers every study start to finish by keyboard, as a woman and as a man |
| `npm run test:pdf` | Saves a PDF for every Finish outcome and reopens it |
| `npm run build:single` | Builds `RAYDAR_<version>.html` in the repo root |
| `npm run test:offline` | Checks the built file works with no internet |

## Ground rules (Claude follows these too)

- The eSource wording is used exactly as TST wrote it. Problems go back to TST, not patched in RAYDAR.
- No date or rule without the sentence it came from.
- No participant details in the repo, ever.
- Design changes are mocked up and approved before they're built.
- Work happens on the development branch; `main` only when someone says so.
