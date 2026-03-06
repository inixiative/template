# Inquiries

The inquiry system is a generic, type-safe workflow engine for requests that require review and approval. It handles invitations, space management requests, and any asynchronous multi-party interaction.

## Overview

An inquiry has a **source** (who sends it) and a **target** (who receives and resolves it). Both sides are represented with explicit polymorphic fields (`sourceModel` + the matching FK) rather than a single generic ID.

Every inquiry type is backed by a **handler** that defines its source/target structure, content schema, validation logic, and the side effect that runs on approval.

## Data Model

```prisma
model Inquiry {
  type   InquiryType
  status InquiryStatus @default(draft)

  content    Json @default("{}")    // type-specific payload, set on create
  resolution Json @default("{}")    // set on resolve (approved/denied)

  sentAt DateTime?

  // Source (who sends) — fake polymorphism
  sourceModel          InquiryResourceModel  // admin | User | Organization | Space
  sourceUserId         String?
  sourceOrganizationId String?
  sourceSpaceId        String?

  // Target (who receives) — fake polymorphism
  targetModel          InquiryResourceModel
  targetUserId         String?
  targetOrganizationId String?
  targetSpaceId        String?
}
```

### Status Flow

```
draft → sent → approved
             → denied
             → changesRequested → sent (source revises and re-sends)
                                → canceled

draft → canceled
sent  → canceled
```

| Status | Description |
|--------|-------------|
| `draft` | Created but not yet sent. Editable. |
| `sent` | Sent to target. Awaiting resolution. |
| `changesRequested` | Target asked source to revise and re-send. |
| `approved` | Target approved. Handler's side effect has run. |
| `denied` | Target denied. No side effect. |
| `canceled` | Source withdrew the inquiry. |

## API Endpoints

### Create — context-specific routes

Each source context has its own create endpoint. The source fields (`sourceModel`, `sourceUserId`, etc.) are inferred server-side and cannot be spoofed.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/me/inquiries` | Create inquiry from current user |
| `POST` | `/api/v1/organization/:id/inquiries` | Create inquiry from an organization (requires `manage`) |
| `POST` | `/api/v1/space/:id/inquiries` | Create inquiry from a space (requires `manage`) |
| `POST` | `/api/v1/admin/inquiries` | Create inquiry from admin (superadmin only) |

**Create body:**
```typescript
{
  type: InquiryType;
  targetModel: InquiryResourceModel;
  content: Record<string, unknown>;   // validated against handler's contentSchema
  status?: 'draft' | 'sent';          // defaults to 'draft'; 'sent' sends immediately
  targetUserId?: string;              // required when targetModel = User (or use targetEmail)
  targetEmail?: string;               // creates guest user if not found
}
```

**Response:** `inquirySentResponseSchema` — includes `targetUser`, `targetOrganization`, `targetSpace`.

### Lifecycle — on the inquiry resource directly

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/v1/inquiry/:id` | `read` | Get a single inquiry (all 6 relations included) |
| `PATCH` | `/api/v1/inquiry/:id` | `send` | Update `content` or `status` (draft only) |
| `POST` | `/api/v1/inquiry/:id/send` | `send` | Send a draft inquiry |
| `POST` | `/api/v1/inquiry/:id/resolve` | `resolve` | Approve, deny, or request changes |
| `DELETE` | `/api/v1/inquiry/:id` | `send` | Cancel (source only) |

**Resolve body:**
```typescript
{
  status: 'approved' | 'denied' | 'changesRequested';
  explanation?: string;
}
```

### List — sent and received

Each context exposes two list endpoints. Requires `manage` on the parent resource.

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/v1/me/inquiries/sent` | Inquiries sent by me (includes targets) |
| `GET` | `/api/v1/me/inquiries/received` | Non-draft inquiries received by me (includes sources) |
| `GET` | `/api/v1/organization/:id/inquiries/sent` | Inquiries sent by this org |
| `GET` | `/api/v1/organization/:id/inquiries/received` | Non-draft inquiries received by this org |
| `GET` | `/api/v1/space/:id/inquiries/sent` | Inquiries sent by this space |
| `GET` | `/api/v1/space/:id/inquiries/received` | Non-draft inquiries received by this space |

- **Sent** endpoints include `targetUser`, `targetOrganization`, `targetSpace`
- **Received** endpoints include `sourceUser`, `sourceOrganization`, `sourceSpace`
- Draft inquiries are always hidden from received lists

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/inquiries` | List all inquiries (all 6 relations, paginated, searchable) |

## Source & Target Resolution

### Source

`resolveInquirySource` infers the source from the route context:

```
POST /organization/:id/inquiries → sourceModel: Organization, sourceOrganizationId: org.id
POST /space/:id/inquiries        → sourceModel: Space, sourceSpaceId: space.id
POST /me/inquiries               → sourceModel: User, sourceUserId: user.id
POST /admin/inquiries            → sourceModel: admin (no FK)
```

The handler's `sources` config is checked by `validateInquiryHandler` to confirm the resolved source is valid for this inquiry type.

### Target

`resolveInquiryTarget` resolves from `body.targetModel` (already validated by `validateInquiryHandler`):

- `targetModel: User` → `targetUserId` OR `targetEmail` (creates guest if not found)
- `targetModel: Organization` → `targetOrganizationId` OR `targetOrganizationSlug`
- `targetModel: Space` → `targetSpaceId` OR `targetOrganizationSlug` + `targetSpaceSlug` (space slugs are org-scoped)
- `targetModel: admin` → no FK, just sets the model

Slug-based lookups are useful when callers know human-readable identifiers rather than UUIDs.

## Handler Architecture

Every inquiry type maps to a handler registered in `handlers/index.ts`.

```typescript
type InquiryHandler<TContent, TResolution, TResolutionInput = TResolution> = {
  sources: InquirySourceMeta[];
  targets: InquiryTargetMeta[];
  contentSchema: z.ZodType<TContent>;            // parsed on create/update; stored in inquiry.content
  resolutionInputSchema: z.ZodType<TResolutionInput>; // validated from the resolve request body
  resolutionSchema: z.ZodType<TResolution>;      // full stored shape (includes computed fields from handleApprove)
  validate?(db, inquiry, content: TContent): Promise<void>; // called pre-create and pre-update
  handleApprove(db, inquiry, resolvedContent: TContent): Promise<Partial<TResolution> | void>;
  unique?: 'targeted' | 'untargeted'; // enforces one open inquiry per source+target+type ('targeted') or per source+type regardless of target ('untargeted')
};
```

All three type params default to `BaseResolution` (`{ explanation?: string }`), so simple handlers need no generics:

```typescript
// No generics needed — uses defaults
export const simpleHandler: InquiryHandler = { ... };

// Typed handler with custom content and resolution
export const createSpaceHandler: InquiryHandler<SpaceContent, CreateSpaceResolution> = { ... };
```

### `unique` enforcement

Setting `unique` on a handler is automatically enforced — no controller code needed. `validateInquiryPreCreate` reads the flag and calls `validateUniqueInquiry`:

- `'targeted'` — one open inquiry per source + target + type (e.g. you can't invite the same user twice)
- `'untargeted'` — one open inquiry per source + type, regardless of target (e.g. a space can only have one open transfer, even to a different target org)

### `validate` — pre-create and pre-update checks

`validate(db, inquiry, content)` receives the **parsed, typed content** directly (not `inquiry.content`). The `inquiry` argument carries source/target FK fields needed for DB lookups. This is called:

- **On create** — before the DB write, with the incoming content
- **On update** — with the effective post-update content (incoming `content` merged over stored `inquiry.content`)

```typescript
// createSpace handler
const validate = async (db, inquiry, content: SpaceContent) => {
  const { slug } = content; // typed — no cast needed
  const [existingSpace, existingInquiry] = await Promise.all([
    db.space.findFirst({ where: { organizationId: inquiry.sourceOrganizationId, slug } }),
    db.inquiry.findFirst({ where: { type: InquiryType.createSpace, status: { notIn: inquiryTerminalStatuses }, content: { path: ['slug'], equals: slug } } }),
  ]);
  if (existingSpace) throw makeError({ status: 409, message: 'A space with this slug already exists' });
  if (existingInquiry) throw makeError({ status: 409, message: 'An open request already exists for this slug' });
};
```

### `resolvedContent` and the Override Pattern

On approval, `handleApprove` receives `resolvedContent` — the **merge** of `inquiry.content` with any override fields from the resolution body. Only keys declared in `resolutionInputSchema` can flow into `resolvedContent`. `explanation` is always excluded (resolution-only metadata), so it never overrides content fields.

**Opt-in to allow resolver overrides** by declaring the field in `resolutionInputSchema`:
```typescript
// createSpace — admin can rename the space at approval time
const resolutionInputSchema = baseResolutionInputSchema.extend({
  name: z.string().optional(), // ← declared → flows into resolvedContent
});
```

**Opt-out to lock the field** by omitting it from `resolutionInputSchema`:
```typescript
// inviteOrganizationUser — role is locked; resolver cannot change it
// 'role' is NOT in resolutionInputSchema, so it never reaches resolvedContent
const { role } = resolvedContent; // always from original inquiry.content
```

### Current Handlers

| Type | Source | Target | Unique | Side Effect |
|------|--------|--------|--------|-------------|
| `inviteOrganizationUser` | Organization | User | `targeted` | Creates `OrganizationUser` |
| `createSpace` | Organization | admin | — | Creates `Space` under source org |
| `updateSpace` | Space | admin | `untargeted` | Updates `Space` with content fields |
| `transferSpace` | Space | Organization | `untargeted` | Sets `Space.organizationId` to target org |

**Send permissions by type:**

| Type | Role required | How |
|------|--------------|-----|
| `inviteOrganizationUser` (low role: member/viewer) | org `manage` | Admin+ can invite |
| `inviteOrganizationUser` (high role: owner/admin) | org `own` | Owner only can invite |
| `createSpace` | org `own` | Owner only |
| `updateSpace` | space `own` | Space owner or org owner (via `space.own → org.own` delegation) |
| `transferSpace` | org `own` (explicit 2-hop) | Org owner only — space owner alone is not enough |

`updateSpace` and `transferSpace` differ intentionally: `updateSpace` uses `{ rel: 'sourceSpace', action: 'own' }` which delegates through to org.own, so both direct space owners and org owners can update. `transferSpace` uses `{ rel: 'sourceSpace.organization', action: 'own' }` — dot-path traversal that explicitly resolves to the owning organization, bypassing any direct space.own check, ensuring only org owners can initiate a transfer.

## Response Schemas

Defined in `modules/inquiry/schemas/inquiryResponseSchemas.ts`:

| Schema | Relations included | Used on |
|--------|--------------------|---------|
| `inquiryResponseSchema` | All 6 (sources + targets) | Single read, admin list |
| `inquirySentResponseSchema` | Targets only | Sent lists, create response |
| `inquiryReceivedResponseSchema` | Sources only | Received lists |

## Permissions (ReBAC)

| Action | Who can perform it |
|--------|--------------------|
| `read` | Source user/manage-on-source-org-or-space OR target user/manage-on-target-org-or-space |
| `send` | Source-side permission (see handler table above) |
| `resolve` | Target user (self); target org `manage` (except `transferSpace` which requires `own`); target space `manage`; superadmin bypass for `admin` targets |

## Adding a New Handler

1. Create `handlers/<type>/index.ts` implementing `InquiryHandler<TContent, TResolution>`
2. Define `contentSchema` (stored on create) and `resolutionInputSchema` / `resolutionSchema` (validated on resolve)
   - `resolutionInputSchema` — what the resolver submits; fields here (except `explanation`) can override content
   - `resolutionSchema` — full stored shape; extend `resolutionInputSchema` with any computed fields returned by `handleApprove`
   - If no computed fields, both can be the same schema
3. Implement `handleApprove(db, inquiry, resolvedContent: TContent)` — runs side effects; return partial resolution output (merged into stored `resolution`)
4. Add `validate(db, inquiry, content: TContent)` for pre-create/pre-update business-rule checks (slug collisions, membership checks, etc.)
5. Set `unique: 'targeted'` (one per source+target+type) or `unique: 'untargeted'` (one per source+type regardless of target) if uniqueness should be enforced — automatic
6. Register in `handlers/index.ts`
7. Add the new type to `InquiryType` enum in `packages/db/prisma/schema/inquiry.prisma`
8. Run `bun run db:generate` in `packages/db/`
9. Add a `send` permission rule in `packages/permissions/src/rebac/schema.ts`

### Status utilities (`validations/validateInquiryStatus.ts`)

| Export | Used in | Meaning |
|--------|---------|---------|
| `inquiryTerminalStatuses` | Prisma `status: { notIn: ... }` queries | `[approved, denied, canceled]` — closed states |
| `validateInquiryIsEditable` | update controller | draft, sent, or changesRequested |
| `validateInquiryIsDraft` | send controller | must be draft to send |
| `validateInquiryIsResolvable` | resolve controller | sent or changesRequested |
| `validateInquiryIsCancelable` | cancel controller | not yet in a terminal state |

### Create route permission pattern

Create routes do **not** use `validatePermission` middleware. Permissions are checked granularly inside the controller via ReBAC after synthesizing the inquiry partial:

```typescript
const partial = await hydrate(db, 'inquiry', { id: '', type, content, ...source, ...target });
if (!check(permix, rebacSchema, 'inquiry', partial, 'send')) throw makeError({ status: 403, ... });
```

This allows per-type permission rules (e.g. `inviteOrganizationUser` with a high role requires `own`, not just `manage`) without redundant middleware.
