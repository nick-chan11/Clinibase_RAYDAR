---
name: raydar-esource-report
description: Write a clear message to the TST team listing problems in their pre-screening eSource files (conditions that point at missing questions so a question never shows, answers without outcome markers, stray spaces, duplicate names, notes that contradict the answers). Use when someone asks what to send TST, or after a study report finds eSource problems.
---

# eSource problems, written up for TST

RAYDAR uses the eSource exactly as written, so the right fix for an eSource problem is in TST's tool, not in RAYDAR.
This skill turns RAYDAR's file checks into a message TST can act on.

## 1. Gather

```bash
cd raydar-app && npm run study:report -- --all > /tmp/raydar-esource-report.md
```

(Or name one file instead of `--all`.) Use each study's "File check", "Answers without an outcome marker" and
"Verdict" sections.

## 2. Sort by impact

1. **A question never shows**: a condition (visibleIf) points at a question name that isn't in the file
   (e.g. `It depends on "gender_at_birth", which isn't in this eSource`), or looks for an answer value that doesn't
   exist (the report suggests a stray space when that's the likely cause). Recruiters silently skip that question.
   Before reporting a suspected stray space, check the answer values themselves: some files use `'Item 2 '` in both
   the answers and the condition, which works.
2. **Answers without an outcome marker** (✅ ⚠️ 🛑 🚫): RAYDAR can't tell continue from exclude.
3. **Duplicate names**: two elements share a name, so conditions can only see one.
4. Anything you notice in the notes that contradicts the answers (quote both).

## 3. Write the message

One section per study, in TST's terms: page (section) name, the question's wording (first words are enough) and its
element name, what's wrong, and the fix. For example:

> **COR-PAG-26 (CORSERA, Veritus)**
> - *Contraception Criteria page*, "As part of the trial, you won't be able to donate eggs…" (`question13`) and
>   "…donate sperm…" (`question6`): their conditions use `{gender_at_birth}`, but no question in the file has that
>   name, so neither question ever shows. Fix: point the conditions at the sex question's name.

Keep it factual and short. Don't include participant data. Put "found by RAYDAR's file check" at the top so TST know
where it came from. Offer the person the text ready to paste (or a Claude doc if they want to share it).
