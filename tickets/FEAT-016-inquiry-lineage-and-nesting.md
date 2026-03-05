# FEAT-016: Inquiry Lineage, Nesting & Metadata

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-03-04
**Updated**: 2026-03-04

---

## Overview

Extend the inquiry system to support lineage tracking, nested/child inquiries, and contextual metadata. Useful for migrations that spawn inquiries, inquiries that trigger follow-up inquiries on resolution, and any case where knowing the origin or parent of an inquiry matters.

---

## Open Questions (figure out before implementing)

### 1. `parentInquiryId` direct relation vs. `metadata` JSON — or both?

**Option A: Direct `parentInquiryId` FK**
- Explicit, queryable, enforced by DB
- Can traverse chains: `inquiry → parent → grandparent`
- Works well for "resolution spawned a child inquiry" (e.g. `transferSpace` approval creates a new `inviteOrganizationUser`)
- Can enforce constraints (e.g. can't resolve child before parent)

**Option B: `metadata` JSON (like Carde)**
- Flexible, no schema migration needed per new use case
- Good for "soft" context: `{ migratedFrom: 'v1_invite_id', batchId: 'xyz' }`
- Doesn't enforce referential integrity
- Harder to query efficiently

**Option C: Both**
- `parentInquiryId` for structural parent/child relationships
- `metadata` for loose contextual data (origin system, batch, migration ref, etc.)
- More surface area but separates concerns cleanly

**Lean**: Option C is probably right — `parentInquiryId` for spawned inquiries, `metadata` for everything else. But verify against actual use cases first.

---

### 2. What spawns child inquiries?

Known cases to consider:
- **Migration** — a data migration runs and creates inquiries on behalf of existing records; needs origin context
- **Resolution side effect** — approving `transferSpace` could auto-spawn `inviteOrganizationUser` for the new owner
- **Batch creation** — a script creates N inquiries; all share a `batchId` in metadata
- **Recursive approval** — approving a high-level inquiry conditionally spawns sub-inquiries before it can fully resolve

Each of these may have different needs. Don't design for all of them at once.

---

### 3. Depth limits and circular reference protection

If `parentInquiryId` is added, need to decide:
- Max nesting depth (1 level? unlimited?)
- Whether to enforce at DB level or application level
- How to handle cycles (A → B → A)

---

### 4. Interaction with audit logs (FEAT-005)

If audit logs track all mutations, they may already cover "who created this and when". Metadata duplication may be unnecessary for purely historical tracing. But audit logs are append-only and not queryable by business context — metadata on the inquiry itself is more useful for runtime logic.

---

### 5. How does this interact with `handleApprove`?

Currently `handleApprove(db, inquiry, resolvedContent)` runs side effects and returns partial resolution data. If approval should spawn a child inquiry, the handler would need:
- Access to context (userId, source org, etc.) — currently not available in `handleApprove`
- A way to set `parentInquiryId` on the spawned inquiry

This is an architectural touch point — don't extend `handleApprove` signature without considering the broader impact.

---

## Likely Schema Changes

```prisma
model Inquiry {
  // ... existing fields ...

  // Lineage
  parentInquiryId String?
  parentInquiry   Inquiry?  @relation("InquiryChildren", fields: [parentInquiryId], references: [id])
  childInquiries  Inquiry[] @relation("InquiryChildren")

  // Loose context / origin data
  metadata        Json?     @default("{}")
  // e.g. { migratedFrom: 'old_id', batchId: 'abc', origin: 'migration_v2' }
}
```

---

## Auto-Approval Handler Setting

Some inquiry types don't need manual review — they should approve immediately on create.

**Proposed**: `autoApprove` on `InquiryHandler` is either a **function** or a **JSON condition object**:

```ts
// Option A: function — full flexibility, handler decides at runtime
autoApprove?: (inquiry: Partial<Inquiry>, content: TContent) => boolean | Promise<boolean>

// Option B: JSON rules/condition — declarative, inspectable, potentially user-configurable
autoApprove?: Condition  // e.g. { field: 'sourceModel', op: 'eq', value: 'User' }
```

Function is simpler to implement; JSON rules open the door to admin-configurable auto-approval policies without deploys (ties into FEAT-003 feature flags or a future rules engine).

When `autoApprove` evaluates to true, the create controller:
1. Creates the inquiry as normal (audit trail preserved)
2. Immediately calls `resolveInquiry(c, inquiry, 'approved', {})` in the same request

**Open**: Should auto-approved inquiries skip the `send` permission check?

---

## Handler Registry: Remove `as unknown as` Cast

The handler registry currently uses `as unknown as InquiryHandler` to paper over a type mismatch between each handler's concrete generics and the widened registry map type. This means the registry loses per-handler type inference — content and resolution types are erased to `Record<string, unknown>`.

**Goal**: tighten `InquiryHandler` generic constraints so the registry map entries infer correctly without the cast. Each handler should remain fully typed end-to-end from `contentSchema` through `handleApprove`.

Likely approach: a `makeInquiryHandler` helper that preserves inference at definition site — zero runtime cost, no cast needed in the registry.

```ts
export const makeInquiryHandler = <TContent, TResolution, TResolutionInput>(
  handler: InquiryHandler<TContent, TResolution, TResolutionInput>
) => handler;
```

Each handler wraps in `makeInquiryHandler({ ... })` — but this alone isn't enough if the registry is still `Record<InquiryType, InquiryHandler>` (that widens everything again).

Also need the registry typed via a mapped type + `satisfies` to keep keys exhaustive and per-key generics intact:

```ts
const inquiryHandlers = { ... } satisfies Record<InquiryType, InquiryHandler<any, any, any>>;
```

With both changes, `as unknown as` can be removed and inference flows end-to-end from `contentSchema` through `handleApprove`.

---

## Related

- **FEAT-001**: Inquiry system (core) — this extends it
- **FEAT-005**: Audit logs — overlaps with lineage for history tracking; clarify boundary
- **FEAT-002**: Notes — notes attached to inquiries may reduce need for metadata

---

_Stub ticket — capture ideas, decide approach when a concrete use case is being implemented._
