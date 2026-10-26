---
description: Git-hook conventions for the monorepo — lefthook setup, the pre-commit checks (staged-file linters plus the whole-project Sorbet/tapioca-dsl step), the commit-msg scope-format gate, the pre-push full bin/ci gate for affected apps, install/onboarding, and worktree behavior.
---

# Git Hooks

## Purpose

Catch style violations, stale Sorbet RBIs, type errors, malformed
commit messages, and failing suites on the developer's machine, before
they enter history or reach GitHub — the same checks CI enforces, run
locally. One committed config works for both apps and every worktree.

The hooks are layered by cost: `pre-commit` is the cheap staged-file
gate, `commit-msg` is a format gate, and `pre-push` is the full local CI
run for the apps a push actually affects.

See `agent/adr/git-hooks-with-lefthook.md` for why lefthook was chosen
over overcommit/husky/`core.hooksPath`, and
`agent/adr/pre-push-full-ci-gate.md` for why the full suite runs at
`pre-push` despite the "hooks are not a second CI" boundary for
`pre-commit`.

## When to Use

Applies whenever hooks are added, changed, or installed. Not the place to
decide what a check *is* — a hook only invokes checks defined elsewhere
(the app's `.rubocop.yml`, `eslint.config.js`, Sorbet setup, and
`agent/styleguides/git-commits.md`).

## Structure

- Hook config: root `lefthook.yml`, committed.
- Hook scripts with real logic: root `script/` (`script/commit-msg`,
  `script/sorbet-hook`, `script/pre-push`, `script/hook-compose`,
  `script/hook.env`).
- `script/hook-compose` wraps every hook-side `docker compose` call with
  `--env-file script/hook.env`, so hooks never depend on a local `.env`
  (gitignored, and absent in a fresh worktree) or on real secrets.
- `docker-compose.hook.yml` is a hook-only compose override: it adds a
  `redis_hook` service (same Redis image, `healthcheck`, **no**
  `ports:`) and points both apps' `REDIS_URL*` variables at it, so
  `pre-push` tests get a working Redis without publishing host port
  `6380`.
- Install mechanism: root `package.json` devDependency `lefthook`, with
  `"prepare": "lefthook install"`, plus the generated root
  `package-lock.json`.
- Three hooks: `pre-commit`, `commit-msg`, and `pre-push`.

## Interface

- Staged-file `pre-commit` commands receive `{staged_files}`, filter with
  their own `glob`, and set their own `root` (the app directory) so paths
  are app-relative.
- The Sorbet command is the exception: its `glob` only **gates** whether
  it runs (Ruby was staged); the check itself is whole-project and takes
  no `{staged_files}` — it delegates to `script/sorbet-hook <app>`.
- Hook-side `docker compose` commands go through `script/hook-compose`,
  which supplies the non-secret interpolation values from
  `script/hook.env`. It does not `cd`; it only selects the env file, so
  lefthook's per-command `root` still makes `{staged_files}` app-relative.
- `commit-msg` receives the path to the commit-message file as its first
  argument (`{1}`).
- `pre-push` is invoked bare (`run: script/pre-push`) and takes no file
  template. `script/pre-push` derives the pushed file set from git
  (`@{push}..HEAD`, falling back to `origin/main...HEAD`, then all
  tracked files) and maps it to the affected apps. For manual checks it
  also accepts explicit paths and a `--dry-run` flag that prints the
  decision without starting Docker.
- `pre-push` runs the compose stack as base + `docker-compose.ci.yml`
  (for the `db_*` healthchecks, `CI=1`, and `app_core`'s anonymous
  `node_modules` volume) + `docker-compose.hook.yml` (portless Redis).

## Rules

### MUST

- Keep hook config in the committed root `lefthook.yml`; install with
  `lefthook install` (via the root `package.json` `prepare` script) —
  never rely on hand-edited `.git/hooks`.
- Keep the staged-file lint commands (`rubocop`, `eslint`, `prettier`)
  staged-files-only: each selects its files via `glob` and must be a no-op
  when nothing matches.
- Run every `pre-commit` command through `script/hook-compose` against
  the **working tree** (the source bind mount), so the container sees the
  staged files, not a stale image copy. The staged-file linters use the
  base `docker-compose.yml`; the Sorbet command adds the CI override
  (`-f docker-compose.yml -f docker-compose.ci.yml`) so its `up --wait`
  can use the DB healthcheck.
- Run the Sorbet check via `script/sorbet-hook`: per app, start and
  `db:prepare` only that app's `db_*` service (not Redis), then `bundle
  exec tapioca dsl` (regenerate that app's model DSL RBIs), then fail if
  it produced un-staged changes (`git add <app>/sorbet/rbi/dsl` and
  commit again), then `bundle exec srb tc`. Never run `tapioca gems`
  here.
- Keep `script/hook.env` in sync with the variables
  `docker-compose.yml` interpolates with `:?`; hooks must stay runnable
  in a worktree with no `.env` at all.
- Keep `commit-msg` a dependency-free script (no bundler/gems) so it runs
  on any checkout, and have it validate the subject against
  `agent/styleguides/git-commits.md` — `[Scope] Imperative summary`, a
  tag from that guide's list, a capital imperative verb, no trailing
  period, no body/trailer.
- Treat every `pre-commit` check as a subset of CI: anything it runs is
  also a blocking CI check.
- Run the full `bin/ci` for every app a push affects. `app_fetcher/**`
  selects `app_fetcher`; `app_core/**` selects `app_core`; any other
  non-documentation path selects **both**. Only documentation/agent
  paths (`README.md`, `AGENTS.md`, `docs/`, `agent/`, `.claude/`,
  `.cursor/`, `.opencode/`) may skip the gate.
- Start only what `pre-push` needs: the affected app's `db_*` service
  plus `redis_hook`, via `up -d --wait`, then run each app with
  `run --rm --no-deps <app> bin/ci`.
- Run the affected apps sequentially and stop at the first failure,
  naming the app and reminding that `git push --no-verify` is the bypass
  (CI still runs).
- Keep `pre-push` a consumer of `bin/ci`, not a second list of checks:
  the app's `config/ci.rb` decides what "full CI" means.

### SHOULD

- Keep the staged-file lint commands cheap and fast; the whole-project
  Sorbet step already makes a Ruby commit slower, so don't add more
  whole-project work to `pre-commit`.
- Keep the valid scope-tag set in `script/commit-msg` identical to
  `git-commits.md`'s list (update both together).
- Keep `pre-push`'s documentation-only skip list small and explicit;
  anything not listed as documentation defaults to both apps, which is
  what keeps a cross-cutting change from silently under-testing.
- Keep `script/pre-push --dry-run` Docker-free so the affected-app
  decision can be checked in isolation.
- Keep the pre-push skip/failure output explicit about which apps ran,
  which were skipped, and why.

### MUST NOT

- Don't add a `pre-commit` check that isn't also a CI check, or that
  needs the full test suite — `pre-commit` is a convenience gate, not a
  second CI. `pre-push` is the deliberate exception: it runs the full
  `bin/ci`, and every step in `bin/ci` is still a blocking CI check.
- Don't put `{push_files}` (or any file-list template) in the
  `pre-push` command. Lefthook splits a long list into several
  invocations, which would run the full `bin/ci` more than once for one
  push; derive the range inside `script/pre-push` instead.
- Don't start the base `redis` service from `pre-push`: it publishes
  host port `6380` and fails when another worktree's stack already owns
  it. Use `redis_hook`, which publishes no port.
- Don't run the full `bin/ci` (or any test suite) from `pre-commit`.
- Don't run `tapioca gems` in a hook: gem RBIs are regenerated when the
  gems change, not on every commit (and `tapioca gems` regenerates the
  whole gem RBI set).
- Don't let the Sorbet step succeed when `tapioca dsl` changed files that
  aren't staged — that is exactly how DSL-RBI debt accumulates.
- Don't run the `pre-commit` JS lint commands (`eslint`, `prettier`)
  against the CI override — its anonymous `/app/node_modules` volume
  would use the image's Node deps instead of the checked-out ones; use
  the base stack. (`pre-push` is different: it runs the app's `bin/ci`,
  which uses the CI override exactly as CI does.)
- Don't start the port-publishing `redis` service (or any other
  port-publishing dev service) from a hook. The Sorbet check needs only
  its app's `db_*` service; `pre-push` uses the portless `redis_hook`
  instead. Publishing Redis's host port makes hooks fail whenever another
  worktree's stack is already running.
- Don't make hooks depend on the developer's `.env` or on exported
  secrets being present — `script/hook-compose` + `script/hook.env` exist
  precisely so a clean worktree can commit.
- Don't add hook logic inline in `lefthook.yml` beyond a short command —
  put non-trivial logic in a `script/` file.
- Don't depend on hooks for correctness: `git commit --no-verify` is
  always available, and CI is the authority.

## Interaction With Other Layers

```text
git commit
    ↓ pre-commit (lefthook, parallel)
        ├── script/sorbet-hook app_fetcher   (start db_fetcher → db:prepare → tapioca dsl → gate on staged RBIs → srb tc)
        ├── script/sorbet-hook app_core      (same, with db_core)
        ├── app_fetcher: script/hook-compose run --rm app_fetcher bin/rubocop {staged_files}
        ├── app_core:    script/hook-compose run --rm app_core    bin/rubocop {staged_files}
        └── app_core:    script/hook-compose run --rm app_core    npx eslint|prettier --check {staged_files}
    ↓ commit-msg (lefthook) → script/commit-msg {1}   (scope/format gate)
    ↓
commit created

git push
    ↓ pre-push (lefthook) → script/pre-push
        ├── affected apps: app_fetcher | app_core | both (shared paths)
        ├── up -d --wait db_<app>... redis_hook   (portless)
        ├── run --rm --no-deps app_fetcher bin/ci   (if affected)
        └── run --rm --no-deps app_core    bin/ci   (if affected)
    ↓
push sent
```

## Canonical Implementations

- `lefthook.yml` — hook definitions
- `script/commit-msg` — the commit-subject validator
- `script/sorbet-hook` — the per-app `db:prepare` + `tapioca dsl` +
  `srb tc` step
- `script/pre-push` — the push-range → affected-apps decision and the
  sequential `bin/ci` runner
- `script/hook-compose` + `script/hook.env` — the compose wrapper and its
  non-secret interpolation defaults
- `docker-compose.hook.yml` — the portless `redis_hook` service and
  `REDIS_URL*` overrides used only by `pre-push`
- root `package.json` — the `lefthook` devDependency + `prepare` install

## Related ADR

- `agent/adr/git-hooks-with-lefthook.md` — why lefthook, and why hooks
  mirror CI.
- `agent/adr/pre-push-full-ci-gate.md` — why the full `bin/ci` runs at
  `pre-push` for affected apps, and why Redis is portless there.
- `agent/styleguides/git-commits.md` — the format `commit-msg` enforces.
- `agent/styleguides/ci-and-coverage.md` — the CI checks hooks mirror.
- `agent/styleguides/ruby-sorbet.md` — the `tapioca dsl` regeneration
  workflow the Sorbet step automates.
