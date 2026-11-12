# DB-006: A rule that matches nobody matches nobody wherever it is composed

**Status**: ✅ Done
**Assignee**: Aron
**Priority**: High
**Created**: 2026-10-15
**Updated**: 2026-10-15
**Related**: ZLT-5489 / Zealot #2784 (the Zealot fix), ZLT-5486 review

---

## Bug

json-rules compiles a rule that can match nothing (`{ any: [] }`, a false branch) to `{ OR: [] }`.
On its own that matches no rows. As one arm of a hand-written `{ AND: [...] }`, Prisma drops it, and
the AND matches every row the other arms allow.

In the template that meant **a dynamic segment whose rule matches nobody admitted every customer of
its owner**. `compileSegmentWhere` ANDed the compiled where with the provider FK by hand. The new
test in `segmentReconcile.test.ts` reproduces it: before the fix the segment admitted 4 customers,
after it none.

## Fix

Every place a compiled where is composed with our own filters goes through json-rules' own fold:
`andWhere` / `orWhere` (match-nothing absorbs, match-all drops, one arm stands alone), never a literal
`AND: [...]` / `OR: [...]`.

| Site | Composition |
|---|---|
| `packages/db/src/utils/whereWalker.ts` | `merge`, `asOne`, and the `every` arm's implication |
| `apps/api/src/lib/prisma/lensWhere.ts` | a plan step's where plus the scope back to the root |
| `apps/api/src/modules/segment/services/evaluateSegment.ts` | the compiled rule plus the provider FK |
| `apps/api/src/modules/customerRef/lib/customerRefLens.ts` | the segment source plus the caller's where |
| `packages/db/src/utils/sourceQueryValues.ts` | the compiled source plus the caller's where |
| `packages/db/src/utils/sourceQueryWhere.ts` | the compiled source plus the re-checked id set |

`buildWhereClause`'s `OR: [{ key: clause }, { key: null }]` is two literal arms of our own, not a
compiled where, and stays.

## Tests

- `packages/db/src/utils/whereWalker.test.ts`: a scope clause that matches nothing makes the walked
  node match nothing; several live clauses still fold into one AND. The first fails without the fix.
- `segmentReconcile.test.ts`: a segment whose rule is `{ any: [] }` evaluates to no members and
  reconciles to none. Fails without the fix (it admitted every customer of the owner).

## Rule for new code

A where that came out of the rules engine (`toPrisma`, `executePrismaPlan`, a source query) is
composed with `andWhere` / `orWhere` from `@inixiative/json-rules`, never spread into a literal
`AND` / `OR` array.
