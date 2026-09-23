---
name: worktrees
description: Use when starting feature work that needs isolation, when dispatching subagents that will edit code, or when managing existing worktrees. Teaches the repo's `bun run worktree:*` scripts that allocate isolated Postgres DBs, MinIO buckets, a Redis DB, and ports — not plain `git worktree add`.
---

# Worktrees

This repo has its own worktree tooling on top of git. Plain `git worktree add` gives you an isolated checkout. The repo scripts give you an isolated **runtime** — separate Postgres databases (local + test), separate MinIO buckets, a separate Redis logical DB, and separate ports for Web / Admin / Superadmin / API — plus the gitignored artifacts a fresh checkout does not carry. That's the difference between "I can edit files" and "I can run a full dev stack and the test suites alongside the main one."

Always use the scripts. The raw `git worktree add` / `git worktree remove` are in the `bashMainCheckoutGuard` hook's guarded set (see below) — there is no case for them.

## The three commands

| Command | What it does |
|---|---|
| `bun run worktree:create <base-branch> <new-branch> [--skip-db]` | Checks Docker/Postgres up front, allocates a slot (1–9) under a per-slot lock and records it in `.worktrees/.slots/<N>`, creates the git worktree at `.worktrees/<name>/`, generates slot-specific `.env.local` / `.env.test` (root and `apps/*`) synced against the branch's `.env.*.example`, creates the Postgres `<project>_wt_<N>` and `<project>_test_wt_<N>` databases and MinIO buckets, runs `bun install` and verifies workspace resolution, builds the gitignored artifacts (route trees, Prisma client + `prismaMap.gen.ts` + zod, OpenAPI spec + SDK + MSW handlers), pushes the Prisma schema to both DBs, and warns about any worktrees whose branches are already merged into the default branch. Refuses when `<new-branch>` already exists (attach it instead). `--skip-db` skips the Docker gate, databases, buckets, and schema push. |
| `bun run worktree:create <existing-branch> [--skip-db]` | Same, but attaches an existing local/`origin` branch to a new worktree (useful for PR review without disturbing the main checkout). |
| `bun run worktree:list` | Shows every worktree with its slot, branch, and assigned ports. |
| `bun run worktree:destroy <name> [--force]` | Requires a worktree registered with THIS repository's `.git` (an independent repository under `.worktrees/` is refused), prints whether the branch is merged into the default branch, refuses a worktree with uncommitted or untracked changes unless `--force`, drops the Postgres databases, removes the MinIO buckets one by one over the same endpoint provisioning used (each reported as removed / already absent / could NOT remove), `FLUSHDB` on Redis DB `<N>`, kills every listener on the worktree's four ports, removes the git worktree, frees the slot. |

`<name>` for destroy is the worktree directory name (the branch with slashes replaced by dashes). Get it from `bun run worktree:list`.

The scripts resolve the **main checkout** from git, so they do the right thing when run from inside a worktree too: the new worktree lands under the main checkout's `.worktrees/`, never nested.

## When to use which mode

| Scenario | Use |
|---|---|
| Building/editing a feature; will run `bun run local`, tests, or any service | `bun run worktree:create` |
| Dispatching a subagent that will edit code in isolation | `bun run worktree:create` (subagent must `cd .worktrees/<name>` first) |
| Bug fix that needs to be tested locally | `bun run worktree:create` |
| Reviewing a PR locally without disturbing main | `bun run worktree:create <pr-branch>` (attach mode) |
| Anything that touches Prisma schema, migrations, or factories | `bun run worktree:create` — needs the isolated test DB |
| Editing docs/markdown/skills only, no code execution | `bun run worktree:create <base> <branch> --skip-db` — no databases, Docker not required |

When in doubt, use the full mode. Slots are cheap (9 available); the cost of a half-isolated environment (polluting the main DB, port conflicts, stale packages) is high.

## Why not just `git worktree add`?

A bare `git worktree add` lands you in a fresh checkout with **no `node_modules`** and **none of the generated artifacts**. Because `.worktrees/` lives inside the main repo, bun can resolve *up* to the main checkout's `node_modules` — where the workspace links point at **main's** packages, not your worktree's. You'd silently run main's code (e.g. a generated Prisma client that predates a schema change on your branch), and every test file that imports the Prisma client or the SDK dies at boot with a misleading error. `bun run worktree:create` runs `bun install --force` in the worktree, verifies `apps/api/node_modules/@template/db` resolves *inside* the worktree, and builds the artifacts.

## Slot anatomy

Each slot (1–9) gets a unique set of resources. If `WORKTREE_SLOT=3` (and `PROJECT_NAME=template`):

| Resource | Value |
|---|---|
| Web port | `3300` |
| Admin port | `3301` |
| Superadmin port | `3302` |
| API port | `8300` |
| Postgres local DB | `template_wt_3` |
| Postgres test DB | `template_test_wt_3` |
| Redis DB index | `3` |
| MinIO buckets | `template-{system,user}{,-test}-wt-3` |

Slot ownership is recorded in two places (the lock in `.worktrees/.locks/slot-<N>` is held from allocation until the script exits, so a second create running seconds later moves on to the next slot): `.worktrees/.slots/<N>` (one file per slot, containing the owning worktree's path — the registry) and `WORKTREE_SLOT=<N>` on the **first line** of the worktree's `.env.local` and `.env.test` (the marker). Don't edit either. A slot counts as taken when the registry names a registered worktree for it, or when any registered worktree carries the marker **or** references the slot's database names in any of its env files — so a worktree that lost its marker still owns its slot. A registry entry counts as a claim even before its directory exists; an entry whose directory is missing is removed (with a notice) only when no lock for that slot exists and the entry is older than 120 seconds. Two entries naming one worktree are a conflict: `worktree:list` warns, create reserves both. The lock reclaim (`kill -0` on the pid, or mtime for a pid-less lock — `stat -c` on GNU, `stat -f` on BSD) renames the stale lock before deleting it, so two reclaimers cannot both claim. A worktree whose files name **more than one** slot is a conflict: create reserves every slot it names and warns; destroy refuses to guess and asks you to fix the env files first.

The main checkout uses slot 0 / default ports (`3000`, `3001`, `3002`, `8000`). It shows in `bun run worktree:list` as `(main)`.

## What `bun run worktree:create` runs (so you know what to expect)

1. Pre-flight, before anything is created: root `.env.local` must exist; forking onto a branch that already exists is refused; unless `--skip-db`, resolves `docker` (PATH, `~/.docker/bin`, `Docker.app`), requires the daemon, starts a stopped `<project>_postgres` container, and waits for Postgres to answer. Any of these missing is a hard error with the fix in the message — never a "ready" with silently skipped databases.
2. Prunes stale registry entries, scans registered worktrees for allocated slots (registry, marker, or DB-name reference), and surfaces worktrees whose branches are already merged into the default branch — including branches checked out in a worktree, which `git branch --merged` prefixes with `+`.
3. Claims the lowest free slot 1–9 under a `mkdir` lock in `.worktrees/.locks/slot-<N>` (pid-stamped, held until the script exits). A lock whose pid is dead, or that has no pid file and is older than 60 seconds, is reclaimed with a notice. Exits if all 9 are taken.
4. Creates the git worktree off the base branch (creates the new branch if needed; attaches an existing one in attach mode) and writes the registry entry.
5. Copies root's `.env.local` / `.env.test` and `apps/*/.env.*` in (any `WORKTREE_SLOT=` line root carries is dropped), runs `scripts/setup/sync-env.sh` **against the branch's own `.env.*.example` files** (whole multi-line quoted values including escaped quotes, a `#` after the closing quote is a comment, `export KEY=` is honoured on both sides, an unterminated quote is a hard error), then puts `WORKTREE_SLOT=<N>` on the first line of `.env.local` / `.env.test` and rewrites the slot ports / URLs / DB names / Redis index / buckets — in the root files and in `apps/api/.env.local`, whose `PORT` and `API_URL` override root's under `with-env`. Every env read and rewrite accepts `export KEY=`, quoted values, and a trailing `# comment`, and verifies itself: a `DATABASE_URL` or localhost `REDIS_URL` that cannot be pointed at the slot (credential-less URLs and passwords containing `& | /` are fine; an empty or malformed value is not) is a hard error naming the file, the key, and the cause; unless `--skip-db`, a missing `DATABASE_URL` for the local or test side is a hard error naming the key and the files searched. Every generated env file must source cleanly in a subshell; one that does not is a gap.
6. Creates both Postgres databases; a failed inventory query (`pg_database`) aborts rather than being read as "absent". A database already on the slot is dropped only when no registered worktree references that slot (a leftover from a worktree removed without `worktree:destroy`); if one does, the script refuses and names it.
7. Provisions the slot's MinIO buckets.
8. `bun install --force --ignore-scripts` in the worktree and verifies `apps/api/node_modules/@template/db` resolves *inside* the worktree.
9. Builds the gitignored artifacts: `bun run generate:routes` (`apps/*/app/routeTree.gen.ts`), `bun run db:generate` (Prisma client, `prismaMap.gen.ts`, zod), `bun run generate:sdk` (OpenAPI spec, `packages/sdk/src/generated`, `packages/ui/src/test/mocks/handlers.gen.ts`).
10. Pushes the Prisma schema to both DBs (`bun run db:push:dev`) and pings the local one.
11. Prints a summary. Any failure after the git worktree exists ends with the exact `bun run worktree:destroy <name> --force` to clean up; a failure before it releases the slot registry entry. Green **ready** means every step passed. Yellow **created WITH GAPS** lists exactly which env file, artifact, or push is missing and the command to rerun in the worktree; do not run services or tests until the list is empty.

`--skip-db` (any position) skips step 1's Docker gate and steps 6, 7, and 10 — for docs/skills work that never runs services or tests. Artifacts are still built.

## Running services in the worktree

After `cd .worktrees/<name>`:

```bash
bun run local      # full stack (API + web + admin + superadmin) on this slot's ports
bun run local:db   # just bring up the Docker services
```

The slot-specific env files already point everything at the right ports/DBs/buckets — no additional config needed. Tests (`bun run test`, `bun run test:fe`) use the slot's `.env.test`.

## Subagents, sessions, and the main checkout

When you dispatch a subagent to do code work in a worktree, **the subagent does not automatically inherit your working directory** — it defaults to the main repo path. Two consequences:

1. Always tell the subagent the **absolute worktree path** in the prompt: `Work entirely in <repo>/.worktrees/<name>. Do NOT touch the main repo path.`
2. After the subagent finishes, verify it didn't edit files in the main repo — check `git status` in both places.

The same applies to your own session: the Bash tool's cwd can reset to the main checkout between calls (after a session restart, or after a command that `cd`'d outside the repo). A bare `bun add`, `git commit`, or `git push` then lands on main.

The `bashMainCheckoutGuard` hook (`.claude/hooks/`, PreToolUse on Bash + SessionStart) denies a Bash command when ALL of these hold: this session has been inside a linked worktree of THIS repository that still exists; the session cwd is now the main checkout; the main checkout is on the default branch (`origin/HEAD`, normally `main` — `REQUIRE_MAIN_BRANCH` in the hook); and some segment of the command runs one of `bun add/a/remove/rm/update`, `bun install/i <package>` (a bare `bun install`/`bun i`, with or without options, is allowed), `git commit/push/merge/rebase/cherry-pick/revert/am`, `git worktree add/remove/move/prune`, `prisma migrate dev`, `bun run db:migrate` (also as `bun --cwd <pkg> db:migrate`, `bun run --cwd <pkg> db:migrate`, `bun --cwd <pkg> run db:migrate`) whose effective directory is not lifted. The effective directory follows any earlier `cd`/`pushd` in the command that runs in the same shell — a `cd` inside `( )`, or ending in `|` or a single `&`, does not move it (`{ }` does) — or the segment's own `git -C`, `bun --cwd` (anywhere in the segment), `--git-dir`/`--work-tree`/`GIT_DIR`/`GIT_WORK_TREE`, with every target resolved through `realpath`. Lifted means: inside a worktree that `git worktree list` registers (named by any path, symlinks included), or this main checkout named by its own absolute path (`cd /abs/main && …` and `git -C /abs/main …` alike). A relative path into main, a symlink to main, an unregistered checkout or another repository, a non-checkout directory such as `/tmp`, a target containing a substitution or variable, or nesting deeper than six levels is never lifted. Word 0 is normalised (`\git`, `"git"`, `/usr/bin/git`, `$'git'`), quoted strings and heredoc bodies never count, `#` comments are stripped, `--dry-run` and `--abort/--continue/--quit/--skip` never count, and wrappers (`VAR=x`, `env -u X`, `command -p`, `exec -a x`, `sudo -u me`, `timeout N`, `nice -n N`, `time -p`, `nohup --`, `xargs -n 1`, `rtk proxy`, `bunx`, `sh -o pipefail -c`, `eval`, `$( )`, backticks, `{ }`, `if/then`, `do`) are seen through. `git pull`, `git reset`, `git checkout`, and `bun run db:push*` are outside the set by design (they write no tracked files). Fix: `cd <worktree> && …`.

Consequences worth knowing:

- A `cd` earlier in the command moves the effective directory for everything after it in the same shell; a `cd` inside a subshell `( )`, or one ending in `|` / a single `&`, does not (`(cd <wt>) && git push`, `cd <wt> | cat; git push`, `cd <wt> & git push` are all denied; `{ cd <wt>; } && git push` passes). `git -C <dir>` applies only to its own segment; `bun --cwd <dir>` may appear anywhere in its segment and applies to that segment. So `cd <worktree> && git push` passes, `git -C <worktree> status && git push` is denied, and `cd <worktree> && cd .. && git push` is denied. `--git-dir`, `--work-tree`, `GIT_DIR`, and `GIT_WORK_TREE` pointing at main are denied even after a `cd` into a worktree.
- A `cd` to a path that does not exist, is not a git checkout, or contains a variable makes the directory unresolvable, and unresolvable means denied. `cd <wt>;git push` and `cd <wt>&&git push` (no spaces) tokenize like the spaced forms.
- Symlinks are resolved before the decision: a symlink to a registered worktree lifts, a symlink to the main checkout does not (main lifts only by its own absolute path).
- `REQUIRE_MAIN_BRANCH` is an architect decision: while the main checkout sits on a feature branch the hook is inert, so a drifted commit lands on that branch. It is one constant in the hook, with a test either way, so it can be flipped in one edit.
- A session that has only ever worked in the main checkout is never touched. Background Bash calls inherit the session cwd like foreground ones. Per-session state lives under the OS temp dir and entries older than a day are pruned on SessionStart.
- The hook only denies; it never rewrites a command, because PreToolUse hooks run in parallel and the user-level RTK hook already rewrites Bash commands via `updatedInput`.

## When you're done with a worktree

```bash
bun run worktree:destroy <name> [--force]
```

It first prints whether the worktree's branch is merged into the default branch, and refuses when the worktree has uncommitted or untracked changes unless `--force` is passed (the offending paths are listed either way). `<name>` must be a worktree git knows about (or a half-created directory that still has its `.git` file); `.locks`, `.slots`, and arbitrary directories are refused. It reads `WORKTREE_SLOT` from the worktree's `.env.local` (CRLF, quotes, and a leading `export` are tolerated; anything that is not a digit 1–9 is a hard error), refuses if the worktree's files name more than one slot, and — unless another registered worktree also references the slot, in which case it says so and leaves the databases alone — resolves `docker` the same way create does, drops both Postgres databases (`WITH (FORCE)`, so open connections don't block it), removes the MinIO buckets, flushes Redis DB `<N>` on whichever container serves `localhost:6379` (that is what the slot's `REDIS_URL` points at, whether it is `<project>_redis` or another stack's Redis holding the port). Then it kills every listener on the four slot ports (each pid is reported; one that survives is a warning, not a "killed"), removes the registry entry and the git worktree (falls back to `rm -rf` + `git worktree prune` if needed), and frees the slot.

If Docker is unreachable at destroy time it says so; the next `worktree:create` that reclaims the slot drops the leftover databases (after confirming no registered worktree still references them).

**Always destroy worktrees you're done with.** If you don't, you'll run out of slots (max 9). `bun run worktree:list` shows what's allocated; `bun run worktree:create` warns about merged-but-not-destroyed worktrees on every run. If the branch is already merged into the default branch, the destroy is safe — your work is in main already.

## Reference files

| File | Why read |
|---|---|
| `scripts/worktree/create.sh` | Full script — Docker pre-flight, slot lock + registry + allocation, env generation, DB/bucket setup, install + resolution check, generated artifacts, schema push, gap summary |
| `scripts/worktree/destroy.sh` | Cleanup logic — registration check, slot validation, shared-slot skip, DB drop, bucket removal, Redis flush, port kill, worktree remove |
| `scripts/worktree/lib.sh` | Shared helpers — `main_checkout_root`, `default_branch`, `resolve_docker`, `slot_resources`, `worktree_slots`, `slot_claimant`, `claim_slot_lock`, `register_slot`, `ensure_env_var`, `rewrite_database_url`, `kill_port_listeners`, `run_step`, `require_artifact` |
| `scripts/worktree/list.sh` | Output format and how the slot is read from `.env.local` |
| `.claude/hooks/bashMainCheckoutGuard.ts` | The PreToolUse / SessionStart hook described above; `.claude/hooks/tests/` has its tests (`__TEST_REDIRECT__=1 bun test ./.claude/hooks/tests/bashMainCheckoutGuard.test.ts`) |
| `scripts/setup/sync-env.sh` | What the env sync appends (keys the branch's examples have that the copied file lacks, whole quoted values included; never overwrites a value) |
| `scripts/db/push-dev.sh` | What `db:push:dev` does (worktree-aware, refuses non-local DATABASE_URLs) |

## Common mistakes

| Mistake | Fix |
|---|---|
| Using `git worktree add` directly | Use `bun run worktree:create` (`--skip-db` for docs-only) — the hook denies the raw command from a drifted main cwd anyway |
| `worktree:destroy` refused because the worktree is dirty | Commit or discard in the worktree, or `bun run worktree:destroy <name> --force` when the changes are disposable |
| Trusting a green "ready" from the older create | Current script: green means every env file sources, every artifact exists, and the push landed; yellow WITH GAPS lists what to rerun |
| `worktree:create main <branch>` for a branch that already exists | That is attach mode: `bun run worktree:create <branch>` |
| Editing files in the main repo when you meant to work in a worktree | `cd .worktrees/<name>` first; verify with `git rev-parse --show-toplevel` |
| Dispatching a subagent without the worktree path in the prompt | Always include `Work entirely in <absolute path>. Do NOT touch the main repo path.` |
| Leaving merged worktrees around | Run `bun run worktree:destroy <name>` after merge; the script also warns you on every create |
| Hardcoding slot ports | Don't — read them from the worktree's `.env.local` |
| Editing `WORKTREE_SLOT=<N>` in `.env.local` or `.worktrees/.slots/<N>` | Slot is auto-allocated; don't manually shuffle — a mismatch between the two is a conflict destroy refuses to resolve for you |

## Anti-patterns

- **Plain `git worktree add` when you needed isolation.** You'll pollute the main DB, hit port conflicts, or silently run main's packages. Re-create with the script.
- **Working in `.worktrees/<name>` from the main shell session.** Each shell session is one cwd. Open a new shell or `cd` deliberately; don't bounce between paths.
- **Sharing a worktree between two parallel tasks.** Each worktree is one branch. Two things in flight → two worktrees.

## Checklist — starting feature work

1. `bun run worktree:create main <new-branch>` (or off whichever base branch; `--skip-db` for docs-only).
2. Read the summary: green **ready**, or fix the listed gaps first.
3. `cd .worktrees/<new-branch-with-dashes>`.
4. Verify the worktree: `git rev-parse --show-toplevel` should print the worktree path.
5. Run the services you need (`bun run local`, `bun run test`, etc.) — they use slot-specific ports/DBs.
6. Do the work; commit and push from inside the worktree (`cd <worktree> && …` when the cwd may have drifted).
7. When merged: `cd` back to the main repo, then `bun run worktree:destroy <name>`.

## Checklist — dispatching a subagent

1. Get the absolute worktree path: `pwd` from inside the worktree.
2. In the subagent prompt, lead with: `Work entirely in <absolute path>. Do NOT touch the main repo path.`
3. After the subagent finishes, `cd` to the main repo and `git status` to verify it didn't leak edits.
