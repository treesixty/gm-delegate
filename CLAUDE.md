# CLAUDE.md

Shared agent rules live in **`AGENTS.md`**. Read that first; everything in it
applies here. This file holds only Claude-specific configuration, so the two do
not drift.

## Claude Code specifics

- Web fetch is pre-allowed for `foundryvtt.com` and `arxiv.org`
  (`.claude/settings.local.json`). Foundry v14 API pages are the source of truth
  for §0 rows; fetch them rather than recalling an API from training data.
- Prefer editing `docs/gm-delegate-build-spec-v1.md` in place over writing
  addenda. The spec is one file on purpose: §0's verification log only works if
  there is exactly one place it lives.

## History note

Before 2026-08-10 this file held the volatile half of a stable/volatile context
split (`STATUS.md` being the stable half), per the 2026-07-12 decision in
`STATUS.md`. On 2026-08-10 it was overwritten with a draft of `AGENTS.md`. If
that earlier content mattered, recover it from git history:

```
git log --oneline -- CLAUDE.md
git show <commit>:CLAUDE.md
```
