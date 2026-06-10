# DEV-003: Code Annotations + Sitemap Generator (AI/human legibility)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-06-09
**Related**: FEAT-014 (AI Developer Experience); the 2026-06-09 FEATURES.md scorecard

---

## Problem

The map (FEATURES.md, tickets, docs) drifts from the territory (code) because it's
hand-maintained prose with no mechanical link to what it describes. A 2026-06-09 audit of
FEATURES.md against code found **6 outright contradictions** (e.g. "Permify" → actually Permix;
webhook "HMAC-SHA256 / shared secret" → actually RSA-SHA256 asymmetric; "100% factory coverage" →
20/23; "19 models" → 23; "93 tests" → 172) and 11 detail caveats.

The consequence is the same for AI agents and human readers: the surface can't be trusted, so
understanding the repo requires reading ~60k lines, so everyone satisfices and leaves — agents
grab-bag a few files and answer from stale labels; people "bounce off" the repo in the first
session. This is a **legibility + trust** failure, not a quality failure.

## Goal

File-level annotations become the **single source of truth** for a generated map, and a CI rule
makes the map physically unable to drift from the code.

## Design

### Annotations are structured comments, NOT TypeScript decorators

TS decorators only attach to classes/methods; this codebase is functional (route templates,
`makeController`, plain modules). Use a top-of-file JSDoc block comment — the `@`-tag aesthetic
with the mechanism of a comment: attaches to any file, zero runtime cost, parseable by
regex/comment-AST.

```ts
/**
 * @feature email                       // primary user-facing capability (→ ticket/FEATURES)
 * @primitive app-events                // reusable building block(s) this is built on/with
 * @status complete                     // complete | partial | scaffold | planned
 * @ticket COMM-001                     // roadmap link(s)
 * @doc docs/claude/COMMUNICATIONS.md   // explainer link
 * @related webhooks                    // optional secondary features
 */
import { ... }
```

### Axis set — minimal and well-defined (YAGNI on the taxonomy itself)

| Tag | Job | Cardinality |
|-----|-----|-------------|
| `@feature` | user-facing capability; maps to FEATURES.md / a ticket | exactly one **primary** |
| `@related` | secondary features the file also touches | 0..n |
| `@primitive` | reusable building block (app-events, adapter, rebac, hooks, false-poly…) | 0..n |
| `@status` | maturity — cross-checks/derives FEATURES status | 1 |
| `@ticket` | roadmap link(s) | 0..n |
| `@doc` | docs/claude explainer | 0..1 |

**Deferred on purpose:** `@category` (derivable from path — `apps/api/modules/email` → api/module)
and `@tags` (freeform → entropy magnet). Add a third axis only when a concrete need appears.
Rationale: overlapping axes get mis-tagged and the map becomes noise; one primary feature per file
keeps the reverse-index ("where does feature X live?") unambiguous.

Only `@feature` (or `@primitive` for pure-primitive files) + `@status` are required; the rest are
optional so annotating stays cheap (or contributors won't do it).

### Generator outputs

From a single pass over annotated files:
1. **`MAP.md`** — the high-altitude entry point: grouped by feature and by primitive, each with its
   file list + status. The "look at everything cheaply" index that defeats agent grab-bag.
2. **Reverse indexes** — feature→files and file→feature(s).
3. **Generated FEATURES.md** (or a verified diff against the hand-written one) — prose downstream of
   code, never hand-maintained against it.
4. **Coverage report** — unannotated files, so annotation coverage can grow to 100%.

### CI honesty rule (the real prize)

A rule (`scripts/ci/rules/`) that fails when:
- a file's `@status complete` but its co-located tests don't pass / don't exist,
- a cited `@ticket` / `@doc` path doesn't exist,
- a `@feature` claimed in FEATURES.md has no file claiming it (orphan claim),
- a file is unannotated (once coverage hits 100%, enforce it).

This is what prevents the scorecard's 6 contradictions from ever recurring — the map can't lie,
because CI checks it against the territory on every PR.

## Rollout

- ~850 source files. **Do not hand-annotate** — agent-assisted backfill: an agent reads each file
  and proposes `@feature`/`@primitive`/`@status` (the scorecard was a manual version of this).
- Phase it: (1) annotation schema + parser + `MAP.md` generator; (2) agent backfill of core
  modules/packages; (3) generated/verified FEATURES.md; (4) CI honesty rule, warn-only first, then
  enforcing.

## Open questions

- [ ] Confirm the axis set — accept the deferral of `@category`/`@tags`, or define them crisply now?
- [ ] Generate FEATURES.md fully from annotations, or keep it hand-written and only *verify* it?
- [ ] Annotation for non-TS assets (prisma schema, sql, sh) — same block-comment convention?
- [ ] How does `@status` relate to the ticket status — derived, or independent and cross-checked?

## Why this is in scope even before adoption polish

Making the repo legible to AI is the same work as making "primitive is beyond reproach" a
*measurable* claim — you can't certify a primitive complete if the map lies about what's done. The
annotation + honesty rule turns the manual scorecard into an automatic, always-green guarantee.
