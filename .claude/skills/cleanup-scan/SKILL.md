---
name: cleanup-scan
description: Use after finishing a piece of work and before pushing it (the cleanupScanGate hook refuses `git push` until this has run on HEAD). Scans the outgoing diff for duplicated or parallel machinery, names against the vocabulary, an adversarial review, the reviews Aron asks for most, collisions with in-flight branches and PRs, doctrine drift, template divergence and leftovers, fixes what it finds, then records the scan.
---

# Cleanup Scan

Work sprawls faster than anyone reviews it: a helper that already exists, a second auth path, a port that lands on code another branch is deleting. Every one of those was findable before the push. This scan is how you find them.

Scope is the outgoing diff: `git diff origin/<default-branch>...HEAD` plus anything uncommitted. Fix what you find in the code, re-run the checks, then record.

## 1. Duplicates and parallel machinery

Before anything the diff adds counts as new, prove nothing already does its job: in this repository,
in template and the sibling forks, and in the `@inixiative/*` libraries it touches.

- Inventory first. Search by concept, not only by name: `bunx atlas query`, `git grep` on the verbs and nouns it deals in, the callers of the thing it wraps, the library's `docs/VERBS.md`.
- "It doesn't fit" needs evidence: express the case on the existing primitive and run it, with output. A subagent's "nothing fits" is a claim until you reproduce what it rests on.
- A new thing next to an old thing that does the same job is parallel machinery. Use the existing one, or extend it, and delete the new one. If neither fits, the diff must say why and show the bridge you tried (AI/ENTRYPOINT.md §4).
- The same job done in two repositories: one owns it, the others consume it.
- When you change a signature, follow the old one everywhere: callers, tests, docs, examples, tickets.

## 2. Naming

Every name the diff adds or changes is read against `docs/claude/NAMING.md` § Terminology.

- Look up the vocabulary first: the verb table, the field vocabulary, the side names, and the library's `docs/VERBS.md` for anything that is a library operation. Use the word that already means this; add a row only when the operation is genuinely new, and say so in the PR.
- Look up the name: search for the concept. If the codebase already has a name for this thing, use it; a second name for one concept is the same failure as a second implementation.
- Read the name as a short sentence: does it say what the code does, to what, and that it does I/O, throws or writes? Rename anything that describes its mechanism, uses a metaphor, or says something the code does not do.
- Retired names stay retired: when a rename lands, the old name may not come back in code or docs.

## 3. Adversarial review

A separate agent tries to break the change before it reaches Aron: wrong behaviour, a side swapped,
a permission or tenant boundary opened, data lost, a contract or stored value changed without a port
note. Give it the code and the claim, not your conclusion. Fix what it confirms; reproduce anything
it reports before relaying it. A plan or a change to what a primitive means is reviewed against
Aron's stated principles before code is written.

## 4. The reviews Aron asks for most

Each comes from a correction he has given more than once (`~/code/inixiative/FEEDBACK-LOG.md`).

- **Overbuild and underbuild:** surface that earns nothing goes; a foreseen need is built whole (§0.3).
- **Defensive-code theater:** no catch-and-rethrow, no hand-built error the error handler already maps, no re-checking a library's contract; a guard lives once, in the primitive.
- **Special cases:** a carve-out for one input is a missing general rule. Restate the case another way; if it behaves differently, fix the rule.
- **Backwards compatibility:** none. No aliases, dual-accept or transitional code; a one-off data fix is a throwaway script.
- **The why:** every doc, plan and PR says the problem it solves and the evidence that chose it.
- **History first:** before a design, search what Aron already decided (rulings ledger, `~/.claude/history.jsonl`, git log).
- **Backport:** a template change names how Kingdom and Tribe get it, including any stored value that must be renamed to keep rows.

## 5. In-flight collisions

- `gh pr list --state open`, and the remote branches not yet merged (`git branch -r --no-merged origin/<default-branch>`): diff each one's changed files against yours. Read any that overlap.
- A branch that deletes, replaces or rewrites what you changed means your work may be aimed at code that is going away. Stop and ask before pushing.
- In a fork, also check template's open PRs for the same concern. If template is about to change it, port that rather than inventing a local version.

## 6. Doctrine drift

Re-read AI/ENTRYPOINT.md §0 to §0.5 and the `docs/claude` page for every area the diff touches (Quick Doc Routing, §11), then read the diff against them. Fix the violations. Don't relitigate the rules.

## 7. Template parity (forks only)

For each changed file that also exists in template, diff it against template's default branch. A difference must be one this repository intends; when it isn't, match template. When template is the one that's wrong, say so instead of copying the mistake.

## 8. Leftovers

Unused imports and exports, dead files, stale docs and comments, baselines or exemptions the change made unnecessary, debug output, and files the change made obsolete.

## 9. Verify and record

1. `bun run check` passes. A failure that predates the change is shown on the default branch, not assumed.
2. Commit the fixes.
3. Record the scan of the exact commit you will push:

```bash
git rev-parse HEAD > "$(git rev-parse --git-path cleanup-scan)"
```

The gate compares that file to HEAD, so any later commit needs a new scan. In the report, name what each step found and fixed, or that it found nothing.
