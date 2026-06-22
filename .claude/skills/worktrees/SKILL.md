---
name: worktrees
description: Use when starting feature work that needs isolation, when dispatching subagents that will edit code, or when managing existing worktrees. Teaches the repo's `bun run worktree:*` scripts that allocate isolated Postgres DBs, MinIO buckets, a Redis DB, and ports — not plain `git worktree add`.
---

# Worktrees

This repo has its own worktree tooling on top of git. Plain `git worktree add` gives you an isolated checkout. The repo scripts give you an isolated **runtime** — separate Postgres databases (local + test), separate MinIO buckets, a separate Redis logical DB, and separate ports for Web / Admin / Superadmin / API. That's the difference between "I can edit files" and "I can run a full dev stack alongside the main one."

Always use the scripts unless you have a specific reason not to.

## The three commands

| Command | What it does |
|---|---|
| `bun run worktree:create <base-branch> <new-branch>` | Allocates a slot (1–9), creates the git worktree at `.worktrees/<name>/`, generates a slot-specific `.env.local` and `.env.test`, creates the Postgres `<project>_wt_<N>` and `<project>_test_wt_<N>` databases and MinIO buckets, runs `bun install` + pushes the Prisma schema, and warns about any worktrees whose branches are already merged into the main branch. |
| `bun run worktree:create <existing-branch>` | Same, but attaches an existing local/`origin` branch to a new worktree (useful for PR review without disturbing the main checkout). |
| `bun run worktree:list` | Shows every worktree with its slot, branch, and assigned ports. |
| `bun run worktree:destroy <name>` | Drops the Postgres databases, removes the MinIO buckets, `FLUSHDB` on Redis DB `<N>`, kills processes on the worktree's four ports, removes the git worktree, frees the slot. |

`<name>` for destroy is the worktree directory name (the branch with slashes replaced by dashes). Get it from `bun run worktree:list`.

## When to use the scripts vs. plain `git worktree add`

| Scenario | Use |
|---|---|
| Building/editing a feature; will run `bun run local`, tests, or any service | `bun run worktree:create` |
| Dispatching a subagent that will edit code in isolation | `bun run worktree:create` (subagent must `cd .worktrees/<name>` first) |
| Bug fix that needs to be tested locally | `bun run worktree:create` |
| Reviewing a PR locally without disturbing main | `bun run worktree:create <pr-branch>` (attach mode) |
| Anything that touches Prisma schema, migrations, or factories | `bun run worktree:create` — needs the isolated test DB |
| Editing docs/markdown/skills only, no code execution | `git worktree add` is fine — slot allocation is overhead |

When in doubt, use the script. Slots are cheap (9 available); the cost of a half-isolated environment (polluting the main DB, port conflicts, stale packages) is high.

## Why not just `git worktree add`?

A bare `git worktree add` lands you in a fresh checkout with **no `node_modules`**. Because `.worktrees/` lives inside the main repo and workspaces are hoisted to the root, bun then resolves *up* to the main checkout's `node_modules` — where the `@template/*` symlinks point at **main's** packages, not your worktree's. You'd silently run main's code (e.g. a generated Prisma client that predates a migration on your branch). `bun run worktree:create` runs `bun install` in the worktree and verifies `node_modules/@template/db` actually linked, so the worktree owns its own resolution.

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

The slot is recorded as `WORKTREE_SLOT=<N>` at the top of the worktree's `.env.local`. Don't edit it.

The main checkout uses slot 0 / default ports (`3000`, `3001`, `3002`, `8000`). It shows in `bun run worktree:list` as `(main)`.

## What `bun run worktree:create` runs (so you know what to expect)

1. Scans existing worktrees for allocated slots; surfaces worktrees whose branches are already merged into the main branch (clean-up candidates).
2. Claims the lowest available slot 1–9. Exits if all 9 are taken.
3. Runs `git worktree add` to create the checkout off the base branch (creates the new branch if needed; attaches an existing one in attach mode).
4. Copies the root `.env.local` into the worktree and rewrites the slot-specific ports, URLs, DB name, buckets, and Redis index.
5. Same for `.env.test`.
6. Creates the Postgres databases and MinIO buckets for the slot.
7. Runs `bun install --ignore-scripts` in the worktree and verifies `node_modules/@template/db` linked (hard-fails otherwise — see "Why not just `git worktree add`?").
8. Pushes the Prisma schema to both the local and test DBs (`bun run db:push:dev`).
9. Smoke-tests connectivity to the slot's local DB.
10. Prints a summary with the worktree path, ports, DBs, and buckets.

If Docker isn't running, the DB/bucket steps print a warning but the script proceeds — bring Docker up (`bun run start:db`) and re-run the relevant steps inside the worktree later.

## Running services in the worktree

After `cd .worktrees/<name>`:

```bash
bun run local      # full stack (API + web + admin + superadmin) on this slot's ports
bun run local:db   # just bring up the Docker services
```

The slot-specific `.env.local` already points everything at the right ports/DBs/buckets — no additional config needed. Tests (`bun run test`, `bun run test:fe`) use the slot's `.env.test`.

## Subagents and worktrees

When you dispatch a subagent to do code work in a worktree, **the subagent does not automatically inherit your working directory** — it defaults to the main repo path. Two consequences:

1. Always tell the subagent the **absolute worktree path** in the prompt: `Work entirely in <repo>/.worktrees/<name>. Do NOT touch the main repo path.`
2. After the subagent finishes, verify it didn't edit files in the main repo — check `git status` in both places.

## When you're done with a worktree

```bash
bun run worktree:destroy <name>
```

This reads `WORKTREE_SLOT` from the worktree's `.env.local`, drops both Postgres databases, removes the MinIO buckets, flushes Redis DB `<N>`, kills any processes on the four slot ports, removes the git worktree (falls back to `rm -rf` + `git worktree prune` if needed), and frees the slot.

**Always destroy worktrees you're done with.** If you don't, you'll run out of slots (max 9). `bun run worktree:list` shows what's allocated; `bun run worktree:create` warns about merged-but-not-destroyed worktrees on every run. If the branch is already merged into the main branch, the destroy is safe — your work is in main already.

## Reference files

| File | Why read |
|---|---|
| `scripts/worktree/create.sh` | Full script — slot allocation, env generation, DB/bucket setup, install, schema push |
| `scripts/worktree/destroy.sh` | Cleanup logic — DB drop, bucket removal, Redis flush, port kill, worktree remove |
| `scripts/worktree/list.sh` | Output format and how the slot is read from `.env.local` |
| `scripts/db/push-dev.sh` | What `db:push:dev` does (worktree-aware, refuses non-local DATABASE_URLs) |

## Common mistakes

| Mistake | Fix |
|---|---|
| Using `git worktree add` directly when you'll run services | Use `bun run worktree:create` — get the DB/bucket/port isolation and a real `bun install` for free |
| Editing files in the main repo when you meant to work in a worktree | `cd .worktrees/<name>` first; verify with `git rev-parse --show-toplevel` |
| Dispatching a subagent without the worktree path in the prompt | Always include `Work entirely in <absolute path>. Do NOT touch the main repo path.` |
| Leaving merged worktrees around | Run `bun run worktree:destroy <name>` after merge; the script also warns you on every create |
| Hardcoding slot ports | Don't — read them from the worktree's `.env.local` |
| Editing `WORKTREE_SLOT=<N>` in `.env.local` | Slot is auto-allocated; don't manually shuffle |

## Anti-patterns

- **Plain `git worktree add` when you needed isolation.** You'll pollute the main DB, hit port conflicts, or silently run main's packages. Re-create with the script.
- **Working in `.worktrees/<name>` from the main shell session.** Each shell session is one cwd. Open a new shell or `cd` deliberately; don't bounce between paths.
- **Sharing a worktree between two parallel tasks.** Each worktree is one branch. Two things in flight → two worktrees.

## Checklist — starting feature work

1. `bun run worktree:create main <new-branch>` (or off whichever base branch).
2. `cd .worktrees/<new-branch-with-dashes>`.
3. Verify the worktree: `git rev-parse --show-toplevel` should print the worktree path.
4. Run the services you need (`bun run local`, `bun run test`, etc.) — they use slot-specific ports/DBs.
5. Do the work; commit and push from inside the worktree.
6. When merged: `cd` back to the main repo, then `bun run worktree:destroy <name>`.

## Checklist — dispatching a subagent

1. Get the absolute worktree path: `pwd` from inside the worktree.
2. In the subagent prompt, lead with: `Work entirely in <absolute path>. Do NOT touch the main repo path.`
3. After the subagent finishes, `cd` to the main repo and `git status` to verify it didn't leak edits.
