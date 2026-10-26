---
status: implemented
app: fetcher+core
goal: Add a lefthook pre-push hook that runs each affected app's bin/ci before a push reaches GitHub, so CI is no longer the first full gate.
created: 2026-10-26
---

# Development Plan

## Applicable Styleguides

- `agent/styleguides/git-hooks.md` — governs the `lefthook.yml` entry,
  `script/pre-push`, `docker-compose.hook.yml`, the affected-app rule,
  service startup, and the `pre-commit`/`pre-push` boundary.
- `agent/styleguides/ci-and-coverage.md` — constrains the hook to
  `bin/ci` as the definition of the checks CI runs for each app, and
  keeps CI itself unchanged and authoritative.
- `agent/styleguides/git-commits.md` — constrains the commit subject for
  the change (`[Scope] Imperative summary`).
- `agent/adr/base.md` — format for the new
  `agent/adr/pre-push-full-ci-gate.md` and the update to the existing
  lefthook ADR.

## Goal

Add a third lefthook hook — `pre-push` — that runs the full local CI
gate (`bin/ci`) for the app(s) affected by the commits being pushed, so a
red pipeline is caught locally instead of consuming a GitHub Actions run.

## Expected Behavior

- `git push` (a real push, not a dry run) runs `bin/ci` before the push
  is accepted by the remote.
- Both apps are **not** always tested: the hook inspects the files in the
  commits being pushed and runs `app_fetcher/bin/ci` and/or
  `app_core/bin/ci` only for the apps those files affect.
  - only `app_fetcher/**` changed → fetcher only;
  - only `app_core/**` changed → core only;
  - both app trees changed → both, run sequentially;
  - shared/unknown paths changed (`docker-compose*.yml`, `script/**`,
    `lefthook.yml`, root `package*.json`, `.github/**`, etc.) → both,
    conservatively;
  - only documentation paths changed (`README.md`, `AGENTS.md`,
    `docs/**`, `agent/**`, `.claude/**`, `.cursor/**`, `.opencode/**`) →
    no app CI, print a clear "skipped" message and exit 0.
- A failure in either app's `bin/ci` aborts the push with that app's name
  in the message and a reminder that `git push --no-verify` bypasses the
  hook (CI remains the authority).
- The hook starts only the services the run needs: the affected app's
  `db_*` service plus an isolated `redis_hook` service that publishes no
  host port, so the hook works while another worktree's dev stack is
  running.
- `lefthook run pre-push` (the documented manual invocation) behaves the
  same as a real push: with no arguments the script derives the pushed
  file set from git (`@{push}..HEAD`, falling back to
  `origin/main...HEAD`).
- `script/pre-push --dry-run [<path>...]` prints the affected apps and
  runs nothing, which makes the selection logic testable.
- `git commit` behavior is unchanged: `pre-commit` stays staged-files-only
  and never runs the test suite; `commit-msg` stays unchanged.
- CI (`.github/workflows/ci.yml`) is unchanged and remains the blocking
  authority.

## Scope

### In Scope

- `lefthook.yml`: a `pre-push` command invoking one helper script.
- `script/pre-push`: decision logic (affected apps), compose service
  startup, sequential `bin/ci` runs, failure/skip messages, `--dry-run`.
- `docker-compose.hook.yml`: hook-only override with a portless
  `redis_hook` service and app `REDIS_URL*` overrides pointing at it.
- Documentation: `agent/styleguides/git-hooks.md` (the hook is now a full
  gate, not only a staged-file convenience), a new ADR for the decision,
  the existing lefthook ADR's "two hooks" statements, `README.md`, and the
  mirrored agent guidance (`AGENTS.md`, `.claude/CLAUDE.md`,
  `.cursor/rules/development-pipeline.mdc`).

### Out of Scope

- Changing CI workflows, `bin/ci`, or `config/ci.rb` in either app.
- Running coverage (`COVERAGE=1`) locally.
- Changing `pre-commit` or `commit-msg` behavior.
- Adding a shell-test framework (none exists in the repo); verification
  is the dry-run decision matrix plus real runs.
- Parallelizing the two apps' CI runs.
- Reusing an already-running dev Redis or remapping base `redis`'s host
  port.

## Implementation Approach

`lefthook.yml` gets a `pre-push` section with a single command,
`script/pre-push`, deliberately **without** `{push_files}`: lefthook
splits long substituted file lists into multiple command invocations,
which would run the full CI more than once. The script computes the push
range itself, which also makes `lefthook run pre-push` work.

`script/pre-push` (bash, matching `script/sorbet-hook`):

1. Parse an optional `--dry-run` flag and optional explicit path
   arguments (for tests/manual use).
2. Without explicit paths, compute the pushed file list:
   - if `git rev-parse --abbrev-ref --symbolic-full-name '@{push}'`
     resolves, `git diff --name-only '@{push}'..HEAD`;
   - otherwise `git diff --name-only "$(git merge-base origin/main HEAD)"..HEAD`;
   - if neither is possible, fall back to `git ls-files` (run both).
3. Map paths to apps using the rule table in Expected Behavior.
4. With `--dry-run`, print the decision and exit 0.
5. Otherwise, verify Docker is reachable, then start only the needed
   services with
   `script/hook-compose -f docker-compose.yml -f docker-compose.ci.yml -f docker-compose.hook.yml up -d --wait <db_* per app> redis_hook`.
6. Run `… run --rm --no-deps app_fetcher bin/ci` and/or
   `… run --rm --no-deps app_core bin/ci` sequentially; stop at the first
   failure and exit non-zero.

`docker-compose.hook.yml` adds:

- `redis_hook` (image `redis:7-alpine`, healthcheck `redis-cli ping`,
  no `ports:`), so no host port is published;
- `app_fetcher.environment` overrides for `REDIS_URL`,
  `REDIS_URL_SIDEKIQ`, `REDIS_URL_STREAM`;
- `app_core.environment` overrides for `REDIS_URL`, `REDIS_URL_STREAM`,
  `REDIS_URL_DEMO`.

The base `redis` service stays untouched for development. The hook uses
base + `docker-compose.ci.yml` (healthchecks for `db_*`, `CI=1`,
anonymous `node_modules` for `app_core`) + `docker-compose.hook.yml`
(portless Redis). `bin/ci` itself is the source of truth for what runs,
so the hook cannot drift from CI's check set.

## Files To Modify

- `lefthook.yml` — add the `pre-push` hook with a single
  `script/pre-push` command.
- `agent/styleguides/git-hooks.md` — document the third hook, the
  script/override pair, the affected-app rule, and the Redis/worktree
  constraint; scope the existing "no full test suite in hooks" rule to
  `pre-commit` and record `pre-push` as the deliberate exception.
- `agent/adr/git-hooks-with-lefthook.md` — update "Two hooks" to three
  and link the new ADR; adjust the consequences about hook runtime.
- `README.md` — mention the pre-push gate next to the existing hook
  onboarding paragraph.
- `AGENTS.md`, `.claude/CLAUDE.md`,
  `.cursor/rules/development-pipeline.mdc` — keep the mirrored git-hook
  summary in sync (pre-push runs `bin/ci` for affected apps).
- `agent/styleguides/fix_me.md` — only if implementation finds a new
  deviation in a touched file; no planned change.

## Files To Create

- `script/pre-push` — the affected-app decision plus the `bin/ci` runner
  described above.
- `docker-compose.hook.yml` — the portless `redis_hook` service and its
  `REDIS_URL*` wiring for both apps.
- `agent/adr/pre-push-full-ci-gate.md` — records why pre-push runs the
  full `bin/ci` for affected apps despite the earlier "hooks are not a
  second CI" boundary, and the alternatives rejected (always both apps,
  a lightweight audit/brakeman/test subset, relying on CI alone).
- `agent/plans/pre-push-full-ci-hook.md` — this plan.

## Test Plan

There is no shell-test harness in the repo, so the decision logic gets a
deterministic dry-run matrix; the runner path is verified end-to-end.

Decision matrix (`script/pre-push --dry-run …`):

| Input | Expected apps |
|---|---|
| `app_fetcher/app/models/item.rb` | fetcher |
| `app_core/app/actions/steam/sync.rb` | core |
| `app_core/package.json` | core |
| `app_fetcher/Gemfile.lock` | fetcher |
| `app_core/…` + `app_fetcher/…` | both |
| `docker-compose.yml` | both |
| `script/hook.env` | both |
| `README.md` | none |
| `agent/plans/pre-push-full-ci-hook.md` | none |
| `docs/images/dashboard.png` | none |
| no arguments, nothing committed vs `@{push}` | none (clear message) |

End-to-end:

- `lefthook run pre-push` on a commit touching one app → exactly that
  app's `bin/ci` runs and passes; the other app does not run.
- A deliberately failing check (e.g. a temporary RuboCop offense) makes
  `lefthook run pre-push` exit non-zero and print the app name.
- Running with only documentation staged/committed → skip message, exit 0.

## Implementation Steps

1. Write `script/pre-push` with the decision logic and `--dry-run`,
   executable (`chmod +x`), no compose/CI execution yet.
2. Run the dry-run matrix; fix the mapping until every case matches the
   table (this is the red/green loop for the new logic).
3. Add `docker-compose.hook.yml` with `redis_hook` and the `REDIS_URL*`
   overrides.
4. Implement the service startup and sequential `bin/ci` execution in
   `script/pre-push`, with Docker availability check, skip message, and
   first-failure abort.
5. Add the `pre-push` section to `lefthook.yml`.
6. Run `npx lefthook validate` and `npx lefthook install`; confirm
   `.git/hooks/pre-push` exists and runs both `lefthook run pre-push`
   paths.
7. Update the styleguide (`agent/styleguides/git-hooks.md`) — including
   the rule scoping — via the `update-styleguide` workflow.
8. Write `agent/adr/pre-push-full-ci-gate.md`; update
   `agent/adr/git-hooks-with-lefthook.md`.
9. Update `README.md`, `AGENTS.md`, `.claude/CLAUDE.md`,
   `.cursor/rules/development-pipeline.mdc`.
10. Run the end-to-end verification below; record results and any
    deviations in this plan; set `status: implemented` only after both
    apps' `bin/ci` have passed through the hook path.

## Verification

```bash
# Syntax
bash -n script/pre-push

# Decision matrix (no Docker calls)
script/pre-push --dry-run app_fetcher/app/models/item.rb
script/pre-push --dry-run app_core/package.json
script/pre-push --dry-run README.md
script/pre-push --dry-run docker-compose.yml
script/pre-push --dry-run

# Config + installation
npm install
npx lefthook validate
npx lefthook install
ls -l .git/hooks/pre-push

# Real hook path (no actual push — AGENTS.md forbids it)
npx lefthook run pre-push
```

- Both apps' `bin/ci` pass when reached through
  `script/pre-push`/`lefthook run pre-push`.
- `docker compose` starts only `db_fetcher`/`db_core` (whichever apply)
  and `redis_hook`; no container publishes `6380` for the hook.
- The hook leaves the developer's dev stack and other worktrees' stacks
  untouched.
- `git status` stays clean apart from the intended changes (the hook must
  not leave generated files behind: `tapioca`/schema writes, logs, etc.).

## Risks

- **Docker/DB dependency:** a push now requires Docker, the app images,
  and a prepared database. If the image is stale (Gemfile/package.json
  changed), `bin/ci`'s setup step rebuilds bundles/deps inside the
  container; an outdated image may fail confusingly. Mitigation: the
  failure message points at the failing app and `--no-verify`; the
  developer can rebuild the image.
- **Push ranges:** `@{push}` does not exist on a brand-new branch, and
  `git push --all`/multiple refs is not modeled. Mitigation: fall back to
  `origin/main...HEAD`, then to all tracked files (both apps), so the
  hook never silently under-tests.
- **Shared-file mapping drift:** a new top-level directory that affects
  both apps must not be added to the documentation ignore list.
  Mitigation: ignore only documentation/agent paths; everything else
  defaults to both apps.
- **Portless Redis divergence:** the hook tests against `redis_hook` with
  the same URL shape as CI, but not the same container instance. The
  Redis image and version match `docker-compose.yml`.
- **Runtime:** two full `bin/ci` runs on a cross-cutting push can take
  many minutes; that is the accepted cost of moving the gate left.
- **Long file lists:** avoided by not using `{push_files}` in the hook
  command (lefthook would split the list and invoke the script more than
  once).

## Assumptions

- A pre-push gate is allowed to run the full suite, reversing the
  earlier pre-commit-only rule; the user explicitly asked for the full
  gate and accepted the per-app filtering (not both apps always).
- The documented manual invocation `lefthook run pre-push` is an
  acceptable way to verify the hook without performing a push.
- The compose project's default network makes `redis_hook` reachable by
  `docker compose run --rm --no-deps` containers in the same project.

## Completion Criteria

- `lefthook.yml` contains the `pre-push` hook and `npx lefthook validate`
  passes.
- `script/pre-push --dry-run` matches the decision matrix.
- `docker-compose.hook.yml` provides a portless `redis_hook` used only by
  hooks.
- `lefthook run pre-push` runs the affected app's full `bin/ci` and
  blocks on failure.
- The styleguide and ADRs describe the pre-push gate without contradicting
  the "hooks mirror CI, CI is the authority" rule.
- Both apps' `bin/ci` pass through the hook path during verification.

# Implementation Summary

## Implemented

- `lefthook.yml` — added the `pre-push` hook (`run: script/pre-push`),
  deliberately without a file-list template.
- `script/pre-push` (executable) — derives the pushed file set
  (`@{push}..HEAD` → `origin/main...HEAD` → all tracked files), maps it
  to `app_fetcher`/`app_core` (shared/unknown paths → both,
  documentation/agent paths → skip), supports `--dry-run` and explicit
  paths, starts only the needed `db_*` services plus `redis_hook`, then
  runs each affected app's `bin/ci` sequentially and aborts on the first
  failure with the `--no-verify` hint.
- `docker-compose.hook.yml` — hook-only override adding the portless
  `redis_hook` service (healthcheck, no `ports:`) and repointing both
  apps' `REDIS_URL*` variables at it.
- `agent/styleguides/git-hooks.md` — documented the third hook, its
  interface, the affected-app/skip rules, the portless Redis, and scoped
  the "hooks are not a second CI" rule to `pre-commit` with `pre-push`
  as the deliberate exception.
- `agent/adr/pre-push-full-ci-gate.md` — new ADR for the decision and
  rejected alternatives.
- `agent/adr/git-hooks-with-lefthook.md` — updated from two hooks to
  three, added the pre-push consequences/risks, linked the new ADR.
- `agent/styleguides/git-commits.md` — added `pre-push` to the `CI/CD`
  tag's hook list.
- `README.md`, `AGENTS.md`, `.claude/CLAUDE.md`,
  `.cursor/rules/development-pipeline.mdc` — documented the pre-push
  gate in the hook onboarding summary.

## Tests

There is no shell-test harness in the repo; the decision logic was
verified with a throwaway TDD harness (13 dry-run cases, run before the
script existed to confirm RED, then green after implementation) covering:
fetcher-only, core-only, both, shared root files, docs-only, and mixed
inputs. The harness lived outside the repo and was not committed.

Commands executed:

```bash
bash /tmp/opencode/test_pre_push.sh
bash -n script/pre-push
npx lefthook validate
npx lefthook install
npx lefthook run pre-push            # after the commit: both apps
script/pre-push --dry-run app_core/package.json
script/pre-push --dry-run README.md
script/pre-push --dry-run docker-compose.yml
```

## Verification

- `npx lefthook validate` — `All good`.
- Hook installed into the shared git hooks directory
  (`/home/olegus/steam_project/.git/hooks/pre-push`).
- `script/pre-push --dry-run` — all 13 matrix cases matched; the
  documentation-only cases print `skipping bin/ci`; the no-argument case
  correctly skipped with no app-affecting commits.
- `script/pre-push app_core/package.json` — `app_core/bin/ci` passed
  (RuboCop, Sorbet, ESLint, Prettier, Brakeman, bundler-audit, RSpec,
  Vitest, seeds), hook reported `all affected apps passed`.
- `script/pre-push app_fetcher/app/models/item.rb` — `app_fetcher/bin/ci`
  passed (RuboCop, Sorbet, Brakeman, bundler-audit, RSpec, seeds).
- `npx lefthook run pre-push` on the implementation commit — detected
  `app_fetcher app_core` (shared paths in the commit), ran both full
  `bin/ci` gates, both passed, exit 0.
- `git status` after the hook run — clean; the hook left no generated
  files behind.

## Deviations

- The first verification run failed `app_core`'s `bundler-audit` on a
  pre-existing advisory (`crass 1.0.7`, GHSA-pq4g-8rxf-4g29). The user
  had already fixed it on `main`; `origin/main` was fetched and
  fast-forwarded into this worktree (`[Core+Fetcher] Patch crass to
  1.0.8 for GHSA advisory`) before re-running verification. Nothing from
  that patch was re-authored here.

## Remaining Issues

- `app_core`'s Node dependencies come from the CI override's image
  volume, and Ruby gems are baked into the images too. After a
  `package-lock.json` change the image must be rebuilt before relying on
  the frontend checks in `pre-push`; after a `Gemfile.lock` change,
  `bin/setup` installs the missing gems inside each run container
  (`bundle check || bundle install`), which works but is slower until
  the image is rebuilt. The hook does not rebuild images.
- The push-range derivation does not model `git push --all` or pushes
  of multiple refs; those fall back to the current branch's range. The
  safe default (`origin/main...HEAD` → all tracked files) prevents
  under-testing, at the cost of possibly extra runs.
- The affected-app mapping is intentionally a small shell rule; a new
  top-level app directory would need a matching update in
  `script/pre-push` (unknown paths already default to both apps).
