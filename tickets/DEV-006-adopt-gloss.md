# DEV-006: Adopt gloss: comments into `.gloss/`, harvest at commit, a gate that can fail

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-11-02
**Updated**: 2026-11-02
**Repo**: template, then Kingdom and Tribe

---

## Overview

Aron, 2026-11-02: "we need to get the template under Gloss soon."

Template is not under [`@inixiative/gloss`](https://github.com/inixiative/gloss) today. It has no
`.gloss/` tree, no dependency, no hook and no check; the only trace is `.gitattributes`, which already
marks `.gloss/**` `linguist-generated=true` for the day sidecars arrive. Roughly 2,500 `//` comment
lines sit in about 460 files under `apps/` and `packages/`. Kingdom and Tribe are in the same state.

Why: source should read as code. Explanation that an agent or a reader needs lives beside the code in
a mirrored sidecar (`src/foo.ts` → `.gloss/src/foo.ts.md`, one `## symbol` section per declaration),
dated against the symbol's history so stale notes show as stale. Zealot adopted it in ZLT-4395 for the
same reason: rulings lived in review threads and agent memory, where the next agent couldn't see them.

This ticket is the template adoption, written from what Zealot's adoption took and what went wrong
afterwards (ZLT-4530, ZLT-4610, ZLT-4617, ZLT-5945).

## The comment rule template keeps

Source keeps three forms, as gloss defines them: daggers (`// gloss`, `// gloss:file`), machine
directives (`biome-ignore`, `@ts-expect-error`, `@atlas` blocks, shebangs, …) and the rare one-line
`// why:`. Everything else is harvested.

**`// why:` stays, rare and short** (inixiative CLAUDE.md, Aron 2026-10-17): allowed only where the
code can't make a constraint clear, one line, about 1% of comments; tooling never strips it. This
differs from Zealot, whose ruling (#2305) forbids new `why:` lines. Template does not adopt that
ruling. The gloss setup block in `CLAUDE.md` must say template's rule, not Zealot's.

## Scope

1. **Dependency and setup.** Add `@inixiative/gloss` (current 0.1.x) as a devDependency at the
   version the `@inixiative/config` primitives lane blesses, and record it in the version manifest.
   Run `bunx gloss setup --hooks`: creates `.gloss/` with its README, installs the CLAUDE.md block,
   adds the Claude Code `gloss hook read` / `gloss hook grep` hooks. Gitignore `.gloss/.events.jsonl`
   (setup does this; confirm).
2. **Excludes.** A `"gloss": { "exclude": [...] }` block in `package.json` for trees that are not ours
   to gloss: `.claude/skills`, `scripts/ci/rule-violations` (the CI rule fixtures carry comments on
   purpose), `__template`, and anything generated but tracked. Gitignored output (generated SDK, Prisma
   client, route registry) is skipped already. Check each exclude against `bunx gloss lint` output,
   not by guessing.
3. **Promote before harvesting.** Before the one-time harvest, read the comments in the security and
   correctness paths (auth middleware, permissions, encryption, webhooks, batch, request validation)
   and turn each load-bearing constraint into a one-line `// why:`. Filing test: if deleting the gloss
   entry could change what correct behaviour looks like, it belongs in a `// why:`. Why: ZLT-4610's
   harvest moved three security constraints out of `executeRequest.ts` (protocol-relative paths,
   traversal checked on the resolved pathname, lowercased header merge), and the review only caught
   the one file it read; the other 145 harvested files were never checked.
4. **One-time harvest.** `bunx gloss harvest` across the repo in its own commit, nothing else in it, so
   the diff reviews as "comments moved" and lands in `.git-blame-ignore-revs`. Then `gloss lint` and
   `gloss check` both exit 0.
5. **Pre-commit.** In `lefthook.yml`, after Biome: `bunx gloss harvest --staged` (`stage_fixed: true`),
   then `gloss lint` and `gloss check` on the staged source files, with a message pointing at
   `bunx gloss fix <files>`. Why: ZLT-5945. In Zealot, Gloss failed 11% of CI runs and about half was
   inherited from other merges; checking at commit shows the failure in seconds on the branch that
   caused it.
6. **The gate, in `bun run check`.** Template has no GitHub workflow; its gate is `bun run check`,
   which ends in `scripts/ci/run-ci-rules.sh`. Add a `gloss` rule there (`gloss lint` + `gloss check`,
   whole repo) with fixtures under `scripts/ci/rule-violations/gloss/`, in the harness's existing
   pass/fail layout:
   - `fail/plain-comment`: a narrative comment in a source file → the rule must exit non-zero.
   - `fail/dangling-dagger`: a `// gloss` dagger above a statement whose symbol was deleted, with its
     orphaned section → must fail (ZLT-4617: #2170 deleted `MAX_REQUEST_BODY_BYTES` and left its
     dagger, which reattached to a `.use(...)` call).
   - `fail/section-without-dagger` and `pass/clean`.
   Why: ZLT-4530. Zealot's Gloss job reported success on every run while running nothing:
   `node_modules/.bin/gloss` is a symlink, the CLI's `invokedAsBin()` compared the unresolved path to
   its own module path, `main()` never ran and the process exited 0. 82 violations reached main behind
   a green check. Gloss now resolves both sides with `realpathSync` (`src/cli.ts`), but a gate with no
   negative test can go vacuous again on any version bump. The fail fixtures run on every `check`, so
   "clean" and "ran nothing" can no longer look the same.
7. **Docs.** The CLAUDE.md gloss block (template's `why:` rule, "never delete a gloss section or a
   dagger to green a check; run `gloss fix`", the epistemics: gloss is advisory, trust code and
   `why:` lines over it). A short `docs/claude/GLOSS.md` (or a section in an existing doc, if one
   fits) on writing, reading and fixing, linked from `AI/ENTRYPOINT.md`. `FEATURES.md` lists it.
   Add `docs/claude/GLOSS.md` to doc-freshness coverage. Rebuild the Foundry region that covers gloss
   (`.foundry/regions/lib-gloss/`) so it describes template's use, not only the library.
8. **Backport to Kingdom and Tribe.** Same steps, each with its own promote-before-harvest pass and
   harvest commit (the comments differ per repo), its own excludes, and the same `run-ci-rules.sh`
   gate and fixtures. Tribe: check that the harvest commit doesn't trip Railway's auto-deploy into
   anything beyond a no-op rebuild. Both merge once green (merge lanes).

## Interaction with DEV-005 (PR reader)

DEV-005 hides gloss in PR review and lets a reviewer reveal a symbol's section before and after. In
template it has nothing to read until this lands. Adoption makes `.gloss/` the bulk of many diffs
(Zealot #3006: 102 of 332 files), which is the problem DEV-005 exists for; `.gitattributes` already
folds `.gloss/**` on GitHub in the meantime. The `gloss diff <base>..<head>` primitive DEV-005 needs is
not part of this ticket. The one-time harvest PR is the exception: review it as moved text, not with
the reader.

## Acceptance

- `bunx gloss lint` and `bunx gloss check` exit 0 on template main; `.gloss/` holds the harvested
  commentary; load-bearing constraints in the security paths are one-line `// why:` in the source.
- `bun run check` runs the gloss rule, and its fail fixtures fail (a planted narrative comment makes
  `check` exit non-zero).
- A commit with a narrative comment is harvested by the pre-commit hook; a commit with a dangling
  dagger is refused with the `gloss fix` hint.
- CLAUDE.md, the gloss doc and the region describe template's rule.
- Kingdom and Tribe carry the same, merged.

## Related

- Zealot ZLT-4395 (adoption, Done), ZLT-4530 (vacuous gate), ZLT-4610 (harvest moved security
  constraints; the CI comment credited the wrong fix), ZLT-4617 (dangling dagger after a deletion),
  ZLT-5945 (lint gloss at commit; make the check required).
- json-rules PR #7: an open, stale (August) gloss adoption on the library, "promote load-bearing
  constraints to `// why:`". Same steps; settle it in the same pass.
- DEV-005 PR reader. FEAT-014 AI developer experience.
- inixiative CLAUDE.md, "`// why:` lines are rare and short, never stripped" (2026-10-17).
