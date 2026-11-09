# TEST-002: One way to turn database hooks on and off in tests

**Status**: 🚧 Mostly done (2026-11-09): one pattern, every file moved, documented, CI rule added. The pairing helper is still open.
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-10-31
**Updated**: 2026-11-09

---

## Overview

Tests turn database hooks on in three different ways, and the hook registry is shared by every test file in the run:

- about 50 files register the hooks they need in `beforeAll` and unregister them by name in `afterAll` (`unregisterDbHook('rules:create')`, …);
- 4 files use `snapshotHookRegistry()` and restore it in `afterAll` (`apps/api/src/hooks/falsePolymorphism/materializedIds.test.ts`);
- `apps/api/src/hooks/orderedList/tests/setup.ts` registers the rules, contact rules and ordered-list hooks when the module loads and never unregisters them (its comment says sibling files share the registry).

Because some files leave hooks on and others take them off by name, whether a hook runs in a given test depends on which files ran before it. A hook that two files share (the rules hook, the member self-grant hook) can be taken away from a later file by an earlier file's `afterAll`, or left on for files that never asked for it. Production always registers every hook together (`registerHooks()` in `apps/api/src/hooks/index.ts`).

Found while adding the member self-grant rule (PR #232): the rules hook refuses a member without its self-grant, so any test that runs with the rules hook on must also have the self-grant hook on. Several suites failed only in a full run, depending on order.

## Objectives

- ✅ One documented way for a test file to turn hooks on and off, so a file's hooks never depend on the files around it.
- ✅ Hooks that production always registers together are turned on together in tests.

---

## Tasks

- [x] Pick the pattern: register in `beforeEach` (or `beforeAll`), clear with `clearHookRegistry()` in the matching after hook; `snapshotHookRegistry()` and its restore stay valid. Chosen with random test order (Aron, 2026-11-09: "tests need to register and clean their hooks").
- [x] Move every test file to it, including `orderedList/tests/setup.ts` (now `setupOrderedListTests()`, called by each file).
- [ ] A helper that registers a hook together with the hooks production pairs it with (the rules hook with the member self-grant hook).
- [x] Document it in `docs/claude/TESTING.md` (Hooks in tests).
- [x] A CI rule: `scripts/ci/rules/test-hooks-cleared.sh` fails a test file that registers hooks and never clears them, or registers at import time. It still allows `unregisterDbHook` for a hook one test turns on and off.

---

## Open Questions

- Snapshot and restore everywhere, or one global registration in the test preload that matches production?

---

## Implementation Notes

- Registry: `packages/db/src/extensions/hookRegistry.ts` (`registerDbHook` skips a duplicate name with a warning; `unregisterDbHook` removes it for everyone).
- Pairing today: every test file that calls `registerRulesHook()` also calls `registerMemberSelfGrantHook()`, and unregisters it wherever it unregisters the rules hook.
