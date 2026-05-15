# Project instructions — Malaysia GM Report Dashboard

## Git workflow — auto commit & push

**Standing rule (set by the project owner):** after completing any code change,
automatically commit and push to `main` — do **not** ask first.

- Commit **only the files I changed** in that piece of work, staged by name
  (never `git add -A`). Unrelated pre-existing changes get their own commit or
  are left alone.
- Group changes that belong to one feature/fix into a single, coherently-named
  commit. Keep unrelated concerns in separate commits.
- Use Conventional Commit messages (`feat(scope): …`, `fix(scope): …`) with a
  short body explaining the *why*.
- Push to `origin/main` directly — this repo commits straight to `main`, no PR
  branch. The push is the "merge".
- Never skip hooks or force-push.

## Domain rules

POS-parsing and aggregation business rules live in `docs/CLAUDE-RULES.md` —
consult it before touching parsers, import routing, or inventory/region logic.
