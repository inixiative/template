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

`resolveInquiryTarget` resolves from the request body using the handler's `targets[0]` config:

- `targetModel: User` → looks up by `targetUserId` or creates a guest from `targetEmail`
- `targetModel: Organization` → looks up `content[handler.targets[0].targetOrganizationId]`
- `targetModel: Space` → looks up `content[handler.targets[0].targetSpaceId]`
- `targetModel: admin` → no FK, just sets the model

## Handler Architecture

Every inquiry type maps to a handler registered in `handlers/index.ts`.

```typescript
type InquiryHandler = {
  sources: SourceConfig[];           // valid source models for this type
  targets: TargetConfig[];           // how to resolve the target
  contentSchema: ZodSchema;          // parsed and stored in inquiry.content
  resolutionSchema: ZodSchema;       // validated on resolve; can override content fields
  validate?: (db, inquiry) => Promise<void>;  // pre-create business-rule checks
  handleApprove: (db, inquiry, resolvedContent) => Promise<Record<string, unknown>>;
  unique: boolean;                   // enforce one open inquiry per source + target + type
};
```

### resolvedContent and the Override Pattern

On approval, `handleApprove` receives `resolvedContent` — the **merge** of `inquiry.content` with any override fields from the resolution payload:

```typescript
const merged = resolveContent(content, resolutionData, handler.resolutionSchema);
// Only keys declared in resolutionSchema (minus metadata keys) can override content
```

**Opt-in to allow resolver overrides** by declaring the field in `resolutionSchema`:
```typescript
// createSpace handler — admin can rename the space on approval
const createSpaceResolutionSchema = z.object({
  explanation: z.string().optional(),
  name: z.string().optional(),  // ← declared → admin can override the requested name
});
```

**Opt-out to lock the field** by omitting it from `resolutionSchema`:
```typescript
// inviteOrganizationUser — invitee cannot change the role they're offered
// 'role' is NOT in resolutionSchema, so it never reaches resolvedContent
const role = (inquiry.content as { role?: string }).role ?? 'member';
```

### Current Handlers

| Type | Source | Target | Unique | Side Effect |
|------|--------|--------|--------|-------------|
| `inviteOrganizationUser` | Organization | User | Yes | Creates `OrganizationUser` |
| `createSpace` | Organization | admin | No | Creates `Space` (TODO) |
| `updateSpace` | Space | admin | Yes | Updates `Space` (TODO) |
| `transferSpace` | Space | Organization | Yes | Transfers `Space` (TODO) |

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
| `resolve` | Target user (self), or manage on target org/space; superadmin bypass for `admin` targets |

## Adding a New Handler

1. Create `handlers/<type>/index.ts` implementing `InquiryHandler`
2. Add `contentSchema` (stored on create) and `resolutionSchema` (validated on resolve)
3. Implement `handleApprove(db, inquiry, resolvedContent)` — return `{}` or output merged into `resolution`
4. Add `validate` if you need pre-create uniqueness or business-rule checks
5. Register in `handlers/index.ts`
6. Add the new type to `InquiryType` enum in `packages/db/prisma/schema/inquiry.prisma`
7. Run `bun run db:generate` in `packages/db/`
8. Add a `send` permission rule in `packages/permissions/src/rebac/schema.ts`
