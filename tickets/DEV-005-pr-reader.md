# DEV-005: PR reader — group by atlas, gloss and tests hidden by default

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-10-23
**Updated**: 2026-10-23
**Repo**: undecided (see "Where it lives")

---

## Overview

Reviewing a PR on GitHub today is a flat file list in folder order. On a repo with gloss sidecars and
real test coverage, the files a reviewer should read are a minority of the diff. Zealot PR #3006 is
typical: 332 files, of which 102 are `.gloss/` sidecars, 49 are tests, 55 are JSON fixtures and
126 are source.

What we have today only hides. Template `main` `2c665cdf` marks `.gloss/**`, `*.test.ts(x)` and
`**/tests/fixtures/**` `linguist-generated=true`, so GitHub folds them behind "Load diff". Geld
(geld.sh) does the same client-side with a toggle. Neither changes how the rest is read.

This ticket is the better reading tool (Aron, 2026-10-23): purely a visualizer over a GitHub PR.
The PR, its commits and its comments stay on GitHub; the reader holds no state of its own.

## What it looks like

- **Grouped by atlas, not by folder.** Files are presented under the atlas concepts they declare
  (`@partOf`, `@uses`), so a review reads a feature or a primitive, not a directory tree. A file that
  belongs to more than one concept appears under each of them; seeing something twice is intended.
- **Gloss hidden, with toggles.** The sidecar diff never shows by default. For a changed line or
  block, the reader can reveal that symbol's gloss before and after, on hover or by toggle.
- **Tests hidden, summarised.** Test code never shows by default. In its place, a plain-language AI
  summary of the test cases the PR adds or changes. The test code is one click away.

## Where it lives

Open. Aron: it would be nice in Foundry, but it is not part of Foundry; it is a PR review tool, and
PRs are the tasks.

Note for the decision: Foundry already renders gloss for the working tree (gutter markers, hover
preview, pinned notes; `docs/GLOSS.md` in inixiative/foundry) and that viewer explicitly scoped out
"a historical PR diff viewer". The reader either extends that surface to a base..head diff or stands
alone and reuses the same `@inixiative/gloss` library.

## Primitives it needs

- **`gloss diff <base>..<head>`** in `@inixiative/gloss`. For each changed hunk in a source file,
  resolve the enclosing symbol with the existing marker-to-symbol resolver and diff that `## symbol`
  section of the sidecar between base and head. Reuses the resolver and `gloss history`; emits data
  keyed by file and symbol. Not built.
- **atlas** for the grouping: the concept registry and `@atlas` annotations already exist
  (`bunx atlas query`); the reader maps each changed file to its concepts.
- **A test summariser**: an AI pass over the test files in the diff that returns the cases as
  sentences.

## Open questions

- Standalone tool or an extension of Foundry's gloss viewer?
- Is a cheaper intermediate worth shipping first: CI runs `gloss diff` and posts the per-symbol gloss
  delta as GitHub Checks annotations, inline in Files changed, no viewer at all?
- Comments: reading only, with comments left on GitHub, or post review comments through the GitHub
  API so the reader is never left at the moment of attention? Either way nothing is stored locally.

## Related

- Template `.gitattributes` (`2c665cdf`) and Geld: today's hide-only mitigations.
- inixiative/gloss: the sidecar format, resolver, history.
- inixiative/foundry `docs/GLOSS.md`: the existing working-tree gloss viewer.
- `@inixiative/atlas`: the concept map the grouping reads.
- FEAT-014 "Code Reviewer" agent: the AI side of review. This ticket is the human reading surface; both
  would consume `gloss diff`.
