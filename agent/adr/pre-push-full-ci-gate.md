# Pre-push Full CI Gate

## Status

Accepted

## Context

Git hooks are managed by lefthook (`agent/adr/git-hooks-with-lefthook.md`).
Until now the hooks were deliberately narrow:

- `pre-commit` runs staged-file RuboCop/ESLint/Prettier plus a
  whole-project Sorbet check;
- `commit-msg` enforces the `[Scope] Imperative summary` convention.

Nothing ran the actual test suites locally. The first place a broken
`rspec`/`vitest` run, a stale Brakeman finding, or a vulnerable gem
surfaced was the GitHub Actions `linters`/`tests` jobs — after the push.
That spends CI resources on failures the developer could have caught in
seconds-to-minutes locally, and leaves `main` red until a follow-up push.

The repo has two apps with independent `bin/ci` entry points (RuboCop,
Sorbet, Brakeman, bundler-audit, RSpec, seeds; `app_core` additionally
ESLint, Prettier, Vitest). Both need Postgres and Redis to run, and both
are normally exercised through `docker compose`. Several worktrees of
the same repo can be active at once, so anything a hook starts must not
publish conflicting host ports — the base `redis` service publishes
`6380`.

The earlier hook ADR drew a boundary: hooks are a convenience gate, not
a second CI. A full pre-push run appears to violate that boundary, so
the boundary needs to be restated rather than silently broken.

## Decision

Add a third lefthook hook, **`pre-push`**, that runs the full local CI
gate — each affected app's `bin/ci` — before a push leaves the machine.

- **Affected apps, not always both.** `app_fetcher/**` selects
  `app_fetcher`; `app_core/**` selects `app_core`; any other
  non-documentation path selects both. Documentation/agent paths
  (`README.md`, `AGENTS.md`, `docs/`, `agent/`, `.claude/`, `.cursor/`,
  `.opencode/`) skip the gate with a clear message.
- **`bin/ci` is the unit of work**, not a second hand-maintained check
  list. The app's `config/ci.rb` stays the definition of "full CI", so
  the hook cannot drift from CI's check set.
- **The push range is derived inside `script/pre-push`**, not through a
  lefthook file template. Lefthook splits a long file list into several
  command invocations, which would re-run the full gate multiple times
  for one push.
- **Redis is portless in hooks.** `docker-compose.hook.yml` adds a
  `redis_hook` service (no published ports) and repoints both apps'
  `REDIS_URL*` variables at it. The hook compose stack is base +
  `docker-compose.ci.yml` + `docker-compose.hook.yml`.
- **The boundary is restated:** `pre-commit` remains a cheap,
  staged-file gate and must not run suites. `pre-push` is the single
  deliberate exception allowed to run the full `bin/ci`; every step it
  runs is still a blocking CI check, and CI remains the authority.
- **CI is unchanged.** `.github/workflows/ci.yml` still runs on every
  push/PR and remains the required gate; pre-push only reduces the
  chance of it failing.

## Alternatives Considered

### Alternative: Always run `bin/ci` for both apps

Simplest and most conservative.

Rejected because a single-app change would pay for the other app's full
suite on every push. The push range already identifies the affected app,
so the extra run buys nothing.

### Alternative: Lightweight subset (bundler-audit + Brakeman + tests)

Run only the checks that are cheap or security-relevant, for both apps.

Rejected because it reintroduces drift: the hook would stop matching
`bin/ci`/CI (no RuboCop, Sorbet, ESLint, Prettier, seeds), so a green
push would no longer predict a green pipeline. One entry point whose
contents are already maintained beats a second, partial list.

### Alternative: Use lefthook's `{push_files}` template

Let lefthook resolve the pushed files and pass them to the script.

Rejected because lefthook splits long substitutions into multiple
invocations of the same command, which would run the whole `bin/ci`
several times for a large push.

### Alternative: Start the base `redis` service

Reuse the service the dev stack already defines.

Rejected because it publishes host port `6380`; starting it from a hook
fails whenever another worktree's stack is already running. The portless
`redis_hook` service avoids that while keeping the same image and URL
shape the tests expect.

### Alternative: Keep CI as the first full gate

Rejected because it is exactly the status quo the change addresses: a
failing suite costs a GitHub Actions run and a round-trip after the push.

## Consequences

### Positive

- A failing suite, linter, type check, security scan, or seeds step is
  caught before the push, not after a CI round-trip.
- Fewer wasted GitHub Actions runs for avoidable failures.
- `bin/ci` remains the single definition of the full local gate; the
  hook contains no duplicated check list.
- The portless Redis keeps the hook usable alongside other worktrees.

### Negative

- A push now requires Docker, built app images, and a reachable
  database. A fresh checkout must build images before its first push.
- A cross-cutting change can spend several minutes in `pre-push` running
  both suites sequentially.
- `app_core`'s Node dependencies come from the CI override's image
  volume, so a `package-lock.json` change can need an image rebuild
  before the frontend checks reflect it. Ruby dependencies self-heal
  through `bin/setup`'s `bundle check || bundle install`.
- Bypass is always possible (`git push --no-verify`, `LEFTHOOK=0`), so
  the hook is a convenience gate, not an enforcement boundary.

### Risks

- If the affected-app mapping drifts from the app directory layout, a
  cross-cutting change could be under-tested. The conservative default
  (unknown paths → both) and the explicit documentation skip list limit
  this.
- The push-range fallback (`@{push}` → `origin/main...HEAD` → all
  tracked files) can over-run on unusual refs (`git push --all`,
  brand-new branches without an upstream). Over-running is safe;
  under-running is what the fallbacks avoid.
- If a hook is changed without updating CI, the two layers drift. The
  styleguide requires every `bin/ci`/CI change to stay aligned.

## Implementation Constraints

- `pre-push` lives in the committed root `lefthook.yml` as a single
  `run: script/pre-push` command; no file-list template.
- `script/pre-push` derives the pushed files, maps them to apps, starts
  only the affected `db_*` service plus `redis_hook`, and runs
  `bin/ci` sequentially, stopping at the first failure.
- All hook-side compose calls go through `script/hook-compose` (so they
  need no local `.env`).
- `docker-compose.hook.yml` adds only the portless `redis_hook` service
  and the `REDIS_URL*` overrides; the dev stack keeps the base `redis`.
- `script/pre-push --dry-run` must work without Docker so the
  affected-app decision can be verified in isolation.
- CI stays the authority and must not be weakened or removed by this
  decision.

## Related

- `agent/styleguides/git-hooks.md` — the "how" companion to this "why"
- `agent/adr/git-hooks-with-lefthook.md` — the lefthook decision this
  extends
- `agent/adr/ci-via-docker-compose.md` — the CI stack the hook mirrors
- `agent/styleguides/ci-and-coverage.md` — the checks `bin/ci` must match
- `agent/plans/pre-push-full-ci-hook.md` — the plan that surfaced this
  decision
