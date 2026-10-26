# INFRA-045 — json-rules: `conditionalBind`, a condition on a bound value

**Status:** 🆕 Not Started · **Line:** INFRA · **Priority:** Low · **Related:** template #218 (email lens scopes), INFRA-018, INFRA-023

## Context

A lens leaf always compares a field on the row: `{ field, operator, value | path | bind }`. The
value side can be bound in two ways:

- `bind`: required. `bindLens` throws if no value is supplied.
- `bindOptional`: when no value is supplied it becomes `null`, so the leaf compiles to `col IS NULL`.

There is no leaf that tests a bound value on its own. So a single static lens cannot branch on a
fact about the caller (which kind of owner is sending, whether the sender is the platform). Two
workarounds exist today, and both are second-best:

- **Optional-bind branches.** `any: [col = :orgToken?, col = :spaceToken?]`, where the branch that
  applies is the one whose token was supplied. Each branch needs an `exists` guard, or an unused
  branch compiles to `col IS NULL` and matches rows with a null column (#218 does this).
- **Several static lenses chosen by key.** For the case binds cannot express at all, "the platform is
  unrestricted": platform-sent email has no owner. Every branch compares to null and reaches nothing,
  where it should reach everything. #218 ships three email scope declarations picked by owner and
  sender kind for this reason.

## Shape

A leaf whose subject is a binding rather than a field, named `conditionalBind` (Aron), alongside
`bind` and `bindOptional`:

```ts
{ conditionalBind: 'ownerModel', operator: 'equals', value: 'Space' }
```

- It compiles to a constant once bound (`matchAll` / `matchNothing`), so a branch whose kind does not
  apply disappears from the compiled where instead of becoming `IS NULL`.
- Branching on the owner kind then reads like `polymorphicIs` does on a row's discriminator:

  ```ts
  any: [
    { all: [{ conditionalBind: 'ownerModel', operator: 'equals', value: 'platform' }] },
    { all: [{ conditionalBind: 'ownerModel', operator: 'equals', value: 'Space' },
            { field: 'id', operator: 'equals', bind: 'ownerId' }] },
    …
  ]
  ```

- `ownerModel` and `ownerId` are always supplied, so both become required `bind`s. No
  `bindOptional`, no null guards, and one serializable lens per slot.
- `listLensBindings` reports `conditionalBind` names like any other bind. `validateNarrowing` refuses a
  binding subject compared with an operator that needs a field kind it cannot know (or it carries a
  declared kind).

## What it retires

In the template: the three email scope declarations in #218 collapse into one, and the `exists`-guard
helper goes. In Zealot: any lens that today picks between static variants by caller kind.

## Definition of done

- `conditionalBind` leaves in json-rules: compile, `check`, `toSql`, `listLensBindings`, and validation,
  with tests.
- The template email scopes become one static lens. A real-DB test shows they reach the same rows for
  all owner × sender kinds, including platform.
