---
name: cleanup-scan
description: Use after finishing a piece of work and before pushing it (the cleanupScanGate hook refuses `git push` until this has run on HEAD). Scans the outgoing diff for duplicated or parallel machinery, collisions with in-flight branches and PRs, doctrine drift, template divergence and leftovers, fixes what it finds, then records the scan.
---

# Cleanup Scan

Work sprawls faster than anyone reviews it: a helper that already exists, a second auth path, a port that lands on code another branch is deleting. Every one of those was findable before the push. This scan is how you find them.

Scope is the outgoing diff: `git diff origin/<default-branch>...HEAD` plus anything uncommitted. Fix what you find in the code, re-run the checks, then record.

## 1. Duplicates and parallel machinery

For every function, type, file, hook, route, script or doc section the diff adds:

- Search for an existing one by concept, not only by name: `bunx atlas query`, `git grep` on the verbs and nouns it deals in, the callers of the thing it wraps.
- Search beyond this repository: template (for a fork), the sibling forks, and the source repos of the `@inixiative/*` libraries it touches. The primitive usually exists in one of them.
- A new thing next to an old thing that does the same job is parallel machinery. Use the existing one, or extend it, and delete the new one. If neither fits, the diff must say why (AI/ENTRYPOINT.md §4).
- When you change a signature, follow the old one everywhere: callers, tests, docs, examples, tickets.

## 2. In-flight collisions

- `gh pr list --state open`, and the remote branches not yet merged (`git branch -r --no-merged origin/<default-branch>`): diff each one's changed files against yours. Read any that overlap.
- A branch that deletes, replaces or rewrites what you changed means your work may be aimed at code that is going away. Stop and ask before pushing.
- In a fork, also check template's open PRs for the same concern. If template is about to change it, port that rather than inventing a local version.

## 3. Doctrine drift

Re-read AI/ENTRYPOINT.md §0 to §0.5 and the `docs/claude` page for every area the diff touches (Quick Doc Routing, §11), then read the diff against them. Fix the violations. Don't relitigate the rules.

## 4. Template parity (forks only)

For each changed file that also exists in template, diff it against template's default branch. A difference must be one this repository intends; when it isn't, match template. When template is the one that's wrong, say so instead of copying the mistake.

## 5. Leftovers

Unused imports and exports, dead files, stale docs and comments, baselines or exemptions the change made unnecessary, debug output, and files the change made obsolete.

## 6. Verify and record

1. `bun run check` passes. A failure that predates the change is shown on the default branch, not assumed.
2. Commit the fixes.
3. Record the scan of the exact commit you will push:

```bash
git rev-parse HEAD > "$(git rev-parse --git-path cleanup-scan)"
```

The gate compares that file to HEAD, so any later commit needs a new scan. In the report, name what each step found and fixed, or that it found nothing.
