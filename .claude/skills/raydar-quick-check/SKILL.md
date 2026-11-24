---
name: raydar-quick-check
description: Review and tune RAYDAR's Quick check rules (which studies a participant's conditions, smoking or medications rule in or out). Use when Quick check offers a study it shouldn't (or hides one it should), when a study needs a condition Quick check doesn't ask about, or to edit RAYDAR quick check.json.
---

# Quick check rules

Quick check rules are **read automatically** from each study's own eSource questions
(`raydar-app/src/esource/qcrules.js`): a plain "Do you have X?" / "Have you been diagnosed with X?" question whose
answers carry outcome markers. Examples:

- SRSD: "Have you been diagnosed with a form of diabetes?" with "No - exclude" → *Recruits type 2 diabetes only*.
- OLX: "Have you used any tobacco, cannabis, nicotine, or vaping products…?" with "Yes - please exclude" → *Excludes
  smokers and vapers*.

A study is ruled out only when **every** matching answer excludes. Doctor-check answers make it "check". Follow-ups,
"is that okay?" agreements, tests and treatment questions are ignored (the pre-screen handles them).

`RAYDAR quick check.json` (repo root) holds what can't be read automatically:

- `conditions`: the conditions Quick check can ask. `key` (never change once used), `label`, `match` (a pattern that
  finds it in a question), optional `answer` / `answerNot` (when one question covers several kinds, e.g. type 2
  versus type 1 diabetes), optional `sex`. A condition shows on Quick check only when a loaded study has a rule for it.
- `rules`: extra rules the questions don't spell out. **Each needs `source`: the eSource wording it comes from.**
  `item` is a condition key, `smoke` or `meds`; `when` is `y` or `n`; `result` is `no` or `check`.
- `ignore`: rules read wrongly. `{ "file": "<eSource file>", "question": "<question name>", "item": "<optional>" }`.

## See the rules

```bash
cd raydar-app && npm run study:report -- --all
```

Each study's "Quick check rules" section quotes the question and answer each rule came from. In the app,
Tools › Study files lists them too, and Quick check shows which studies each item matters to.

## Common jobs

- **A study needs a condition Quick check doesn't ask** (the report says "Needs X"): add a condition with a `match`
  pattern that finds it in that question (test it against the question text), re-run the report and confirm the
  study now shows "Recruits X only". Consider other studies the new condition might match by mistake.
- **A rule is wrong**: add it to `ignore` with the file and question name from the report. Explain why in your reply.
- **A rule is missing because the eSource only says it in a note** (e.g. CORSERA: "If the PT is taking any
  prescription medications daily they are not suitable"): add a `rules` entry quoting that sentence in `source`. Use
  `check` unless the note is an outright exclusion.

## Then

```bash
npm run study:check-data
npm run test:studies
```

Rebuild (raydar-release). An edited `RAYDAR quick check.json` can also be tried without a rebuild: in RAYDAR,
Tools › Study files › load the file.
