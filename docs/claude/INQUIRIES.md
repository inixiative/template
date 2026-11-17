# Inquiries

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [Data Model](#data-model)
  - [Status Flow](#status-flow)
- [API Endpoints](#api-endpoints)
  - [Create — context-specific routes](#create--context-specific-routes)
  - [Lifecycle — on the inquiry resource directly](#lifecycle--on-the-inquiry-resource-directly)
  - [List — sent and received](#list--sent-and-received)
  - [Admin](#admin)
- [Source & Target Resolution](#source--target-resolution)
  - [Source](#source)
  - [Target](#target)
- [Handler Architecture](#handler-architecture)
  - [`unique` enforcement](#unique-enforcement)
  - [`validate` — pre-create and pre-update checks](#validate--pre-create-and-pre-update-checks)
  - [The request and the response](#the-request-and-the-response)
  - [Current Handlers](#current-handlers)
  - [Asking to change a record's entitlements](#asking-to-change-a-records-entitlements)
- [Response Schemas](#response-schemas)
- [Permissions (ReBAC)](#permissions-rebac)
- [Adding a New Handler](#adding-a-new-handler)
  - [Status utilities (`validations/validateInquiryStatus.ts`)](#status-utilities-validationsvalidateinquirystatusts)
  - [Create route permission pattern](#create-route-permission-pattern)
- [Frontend](#frontend)
  - [Constants and utilities (`packages/ui/src/lib/inquiries/queryKeys.ts`)](#constants-and-utilities-packagesuisrclibinquiriesquerykeysts)
  - [Query key invalidation maps](#query-key-invalidation-maps)
  - [`useInquiryPermission`](#useinquirypermission)
  - [UI Components](#ui-components)
    - [`InquirySourceControls`](#inquirysourcecontrols)
    - [`InquiryTargetControls`](#inquirytargetcontrols)
    - [Per-type UI registry (`packages/ui/src/lib/inquiries/registry.ts`)](#per-type-ui-registry-packagesuisrclibinquiriesregistryts)
  - [Pages](#pages)

<!-- toc:end -->

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

  sentAt    DateTime?  // set once on first send; not cleared when moved back to draft
  expiresAt DateTime?  // set on send via computeExpiresAt(type); reset on changesRequested; cleared on terminal status or when moved back to draft

  // Source (who sends) — false polymorphism
  sourceModel          InquiryResourceModel
  sourceUserId         String?
  sourceOrganizationId String?
  sourceSpaceId        String?
  sourceIntegrationId  String?
  sourceTokenId        String?

  // Target (who receives) — same columns with the target prefix
  targetModel          InquiryResourceModel
  targetUserId         String?
  targetOrganizationId String?
  targetSpaceId        String?
  targetIntegrationId  String?
  targetTokenId        String?
}

enum InquiryResourceModel {
  admin | User | OrganizationUser | Organization | Space | SpaceUser | Integration | Token
}
```

Both ends carry a real relation per party: `sourceUser`, `sourceOrganization`, `sourceSpace`, `sourceIntegration`, `sourceToken`, plus the membership relations `sourceOrganizationUser` (on `[sourceOrganizationId, sourceUserId]`) and `sourceSpaceUser` (on `[sourceOrganizationId, sourceSpaceId, sourceUserId]`); the target side mirrors them. A membership party has no column of its own: it fills the user + organization (+ space) columns. `admin` has no FK. The relations cascade on delete in the database, but no party can be hard-deleted (every party model is soft-delete); a soft-deleted party cancels its open inquiries and keeps every inquiry live (see *Data Model*).

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
| `POST` | `/api/v1/organization/:id/inquiries` | Create inquiry from an organization |
| `POST` | `/api/v1/space/:id/inquiries` | Create inquiry from a space |
| `POST` | `/api/admin/inquiry` | Create inquiry from admin (superadmin only) |

Who may create is the type's `send` rule (see [Permissions](#permissions-rebac)), checked inside `createInquiry`.

**Create body:**
```typescript
{
  type: InquiryType;
  targetModel: InquiryResourceModel;
  content: Record<string, unknown>;   // validated against handler's contentSchema
  status?: 'draft' | 'sent';          // defaults to 'draft'; 'sent' sends immediately
  targetUserId?: string;              // User (or targetEmail), OrganizationUser, SpaceUser
  targetEmail?: string;               // User only; creates a guest user if not found
  targetOrganizationId?: string;      // Organization, OrganizationUser
  targetOrganizationSlug?: string;    // Organization, or Space with targetSpaceSlug
  targetSpaceId?: string;             // Space, SpaceUser
  targetSpaceSlug?: string;
}
```

**Response:** `inquiryResponseSchema` — includes `targetUser`, `targetOrganization`, `targetSpace`.

**Which `targetModel` and `content` a type takes:** `GET /api/v1/inquiry/info` (public) lists, for every registered handler, its `sources`, `targets`, the JSON Schema of `content`, of the extra resolve-body fields (`resolutionInput`) and of the stored `resolution`, plus `unique` and `defaultExpirationDays`. It is generated from `inquiryHandlers`, so a new handler appears there without route changes. A `targetModel` outside `targets` answers 422 (`validateInquiryHandler`); content that fails `contentSchema` answers 422 too.

### Lifecycle — on the inquiry resource directly

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/v1/inquiry/:id` | `read` | Get a single inquiry (all 6 relations included) |
| `PATCH` | `/api/v1/inquiry/:id` | `send` | Update `content`; `status: draft` moves it back to draft (clears `expiresAt`), `status: sent` sends it. Allowed in draft, sent, or changesRequested |
| `POST` | `/api/v1/inquiry/:id/send` | `send` | Send a draft or changesRequested inquiry |
| `POST` | `/api/v1/inquiry/:id/resolve` | `resolve` | Approve, deny, or request changes |
| `DELETE` | `/api/v1/inquiry/:id/cancel` | `send` | Cancel (source only): sets `canceled` and clears `expiresAt`; the inquiry stays live, so both sides see it withdrawn |

**Every state-changing action carries the version the actor saw.** `expectedUpdatedAt` is the inquiry's `updatedAt` as the actor read it: in the body of `PATCH`, `/send` and `/resolve`, and as a query parameter on `DELETE /cancel`. `lockInquiryAtVersion` row-locks the inquiry (`db.findForUpdate`, inside the action's `db.txn`) and answers **409** when the version moved, so an edit between reading and approving fails the approval instead of approving something nobody looked at. The status checks run on the locked row. The UI hooks send `inquiry.updatedAt` on every mutation.

**Resolve body:**
```typescript
{
  status: 'approved' | 'denied' | 'changesRequested';
  expectedUpdatedAt: string;   // the updatedAt you read
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

- Every list loads both sides in full: the user, organization, space, integration, token and project on the source and on the target, so a row says who it acts on and through what
- Draft inquiries are always hidden from received lists

**What a list holds.** Each owner's list holds what is addressed to it and to what it holds beneath it: an organization's holds the inquiries on the organization, its integrations, their tokens and its projects. It does not hold a space's or a member's; those are in the space's list and the member's own. The filter is `whereAxisCarriesOwnerKeys('Inquiry', '<side>Model', owner)` (`packages/db/src/registries/ownerWhere.ts`): one flat filter on the side's own columns, because each row carries the owner keys of what it names. The owner is given by kind (`OwnerKeys`) with null for "holds none": `{ Organization: id, Space: null, User: null }` is the organization alone.

**Carried keys.** An inquiry whose side names an Integration, Token or Project also carries that record's owner keys on the same side (`targetTokenId` plus `targetIntegrationId` and `targetOrganizationId`), written by the carried-owner-keys hook ([DATABASE.md](DATABASE.md#carried-owner-keys)). So the row itself says whose it is, for attribution, audit and events. `inquiryCarriedOwnerKeys.test.ts` checks each owner's list holds its own and what it holds beneath it, and nothing a member or space holds. A space's inquiries carry its organization in a composite key, so a transfer re-keys them and the ones addressed to what the space holds.

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/inquiry` | List all inquiries (all 6 relations, paginated, searchable) |

## Source & Target Resolution

### Source

`resolveInquirySource` infers the source from the route context; the admin controller passes `admin` itself:

```
POST /organization/:id/inquiries → sourceModel: Organization, sourceOrganizationId: org.id
POST /space/:id/inquiries        → sourceModel: Space, sourceOrganizationId: space.organizationId, sourceSpaceId: space.id
POST /me/inquiries               → sourceModel: User, sourceUserId: user.id
POST /api/admin/inquiry          → sourceModel: admin (no FK)
```

No create route sources an `OrganizationUser`, `SpaceUser`, `Integration`, `Token` or `Project` inquiry; those sources are set by the service that already holds the party.

The type's declared `sources` (`INQUIRY_TYPES` in `packages/permissions/src/rebac/inquiryTypes.ts`) are checked by `validateInquiryHandler` to confirm the resolved source is valid for this inquiry type.

### Target

`resolveInquiryTarget` resolves from `body.targetModel` (already validated by `validateInquiryHandler`):

- `targetModel: User` → `targetUserId` OR `targetEmail`: `findUserOrCreateGuest` (`apps/api/src/modules/user/services/findOrCreateGuest.ts`) returns the user with that normalized email or creates an unverified guest and emits `user.created` with `isGuest: true`
- `targetModel: Organization` → `targetOrganizationId` OR `targetOrganizationSlug`
- `targetModel: Space` → `targetSpaceId` OR `targetOrganizationSlug` + `targetSpaceSlug` (space slugs are org-scoped); its organization fills `targetOrganizationId`
- `targetModel: OrganizationUser` → `targetOrganizationId` + `targetUserId` (the membership must exist)
- `targetModel: SpaceUser` → `targetSpaceId` + `targetUserId` (the membership must exist; its organization fills `targetOrganizationId`)
- `targetModel: admin` → no FK, just sets the model
- `targetModel: Token` → `targetTokenId`; `targetModel: Integration` → `targetIntegrationId` (the row must exist; its owner keys are carried, never taken from the body)
- `targetModel: Project` → 422; a request body cannot name it, only a service that holds the party

Slug-based lookups are useful when callers know human-readable identifiers rather than UUIDs.

## Handler Architecture

Every inquiry type maps to a handler registered in `handlers/index.ts`.

```typescript
type InquiryHandler<TContent, TResolution, TResolutionInput = TResolution> = {
  contentSchema: z.ZodType<TContent>;            // parsed on create/update; stored in inquiry.content
  resolutionInputSchema: z.ZodType<TResolutionInput>; // validated from the resolve request body
  resolutionSchema: z.ZodType<TResolution>;      // full stored shape: the parsed input plus handleApprove's output, nothing else from the body
  validate?(inquiry, content: TContent): Promise<void>; // called pre-create and pre-update
  handleApprove(c, inquiry, content: TContent, response: TResolutionInput): Promise<Partial<TResolution> | undefined | void>; // c is the resolve request's context, first as on every service that takes one: the approver acts from it. Approval runs only inside a request (resolve, or auto-approval on send), never in a job
  autoApprove(inquiry): Promise<boolean>;    // called after send; return true to skip human review
  unique?: 'targeted' | 'untargeted'; // enforces one open inquiry per source+target+type ('targeted') or per source+type regardless of target ('untargeted')
  defaultExpirationDays?: number;     // drives computeExpiresAt on send and changesRequested; undefined = no expiry
  appEvents?: InquiryAppEvents;       // per-status app event handlers: sent, approved, denied, changesRequested, resolved
};
```

A type's parties are not on the handler: they are declared once, with their permission levels, in `INQUIRY_TYPES` (`packages/permissions/src/rebac/inquiryTypes.ts`). `createInquiry` checks the resolved source and target against them (`validateInquiryHandler`, 422 on mismatch). `sendInquiry` flips the status to `sent`, sets `sentAt` (first send only) and `expiresAt`, then calls `autoApprove`; on `true` it runs `resolveInquiry(..., approved)` — and with it `handleApprove` — before emitting `inquiry.sent`.

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

`validate(inquiry, content)` receives the **parsed, typed content** directly (not `inquiry.content`). The `inquiry` argument carries source/target FK fields needed for DB lookups. This is called:

- **On create** — before the DB write, with the incoming content
- **On update** — with the effective post-update content (incoming `content` merged over stored `inquiry.content`)

```typescript
// createSpace handler
const validate = async (inquiry, content: SpaceContent) => {
  const { slug } = content; // typed — no cast needed
  const [existingSpace, existingInquiry] = await Promise.all([
    db.space.findFirst({ where: { organizationId: inquiry.sourceOrganizationId, slug } }),
    db.inquiry.findFirst({ where: { type: InquiryType.createSpace, status: { notIn: inquiryTerminalStatuses }, content: { path: ['slug'], equals: slug } } }),
  ]);
  if (existingSpace) throw makeError({ status: 409, message: 'A space with this slug already exists' });
  if (existingInquiry) throw makeError({ status: 409, message: 'An open request already exists for this slug' });
};
```

### The request and the response

An inquiry keeps both sides apart: what was asked is `inquiry.content`, and what the resolver answered is the resolve body. `handleApprove(c, inquiry, content, response)` gets them as two arguments, `content` parsed by `contentSchema` and `response` parsed by `resolutionInputSchema`. Nothing is merged or computed from one onto the other; a handler reads each value from the side it belongs to, and says so in its own code. Auto-approval sends the request back as the response, so a handler always gets the thing it approves (Aron, 2026-11-16).

**A field the resolver may set** is declared in `resolutionInputSchema` and read from `response`:
```typescript
// transferSpace: the approving org may give the space another slug
const slug = response.slug ?? content.slug ?? space.slug;
```

**A field the resolver may not set** is left out of `resolutionInputSchema`, so it is never in `response`:
```typescript
// inviteOrganizationUser: the role is the inviter's
const { role } = content;
```

Why: an approval is the approver's own answer, kept beside the request, never a patch applied to it (Aron, 2026-11-15: "no merge logic and nothing computed against the request"). A shared overlay made every handler's input a mix of the two with nothing saying which side a value came from.

### Current Handlers

| Type | Source | Target | Unique | Expiry | Side Effect |
|------|--------|--------|--------|--------|-------------|
| `inviteOrganizationUser` | Organization | User | `targeted` | 30 days | Creates `OrganizationUser`, or revives the user's removed one (`revive`) with the invited role |
| `createSpace` | Organization | admin | — | 90 days | Creates `Space` under source org |
| `updateSpace` | Space | admin | `untargeted` | 90 days | Updates `Space` with content fields |
| `transferSpace` | Space | Organization | `untargeted` | 30 days | Moves the space and everything keyed to it into the target org; see *Transferring a space* |
| `changeEntitlements` | User | Token, Integration | `targeted` | 30 days | Adds and removes the target's entitlements through `changeEntitlements`; see *Asking to change a record's entitlements* |

All five handlers return `autoApprove: async () => false` — no type currently auto-approves.

### Asking to change a record's entitlements

`changeEntitlements` is addressed to the record whose entitlements change (a Token or an Integration), never to its owner: whoever administers the record answers it (a person, never a token), and it shows in that record's owner's list through the carried keys. Someone who can read the record asks from their own inbox (`POST /api/v1/me/inquiries` with `targetModel` and `targetTokenId` or `targetIntegrationId`); a stranger is refused, so nobody probes ids or is shown another tenant's token and its owner. One open request per asker and record (`unique: 'targeted'`).

- **The request** is `{ add, remove }`: `add` is entitlement entries in the shape the direct add route takes, `remove` is row ids.
- **The response** is the approver's own `{ add, remove }`, narrower or wider than asked. An approval with neither is refused (422, in `handleApprove`): to give nothing, deny. A denial needs neither.
- **Approving is issuing.** `handleApprove` runs the checks the record's own add and remove routes run (`validateTokenWrite` and `validateDelegateRole`, or `validateIntegrationRole`) and then the one writer, `changeEntitlements`, with the approver as writer. An approver who could not grant an added entry directly gets the writer's 403 (a removal needs only administering the record); the resolve transaction rolls back, nothing is written and the inquiry stays open (Aron, 2026-11-16: "The grantor and the person who approves the inquiry need to have access to approve that level… Otherwise, it should error and stay open").
- **The request is checked when asked.** The handler's `validate` runs the writer's own entry check (`entitlementProblem`) on each `add` entry, so a request the writer would refuse (a negated `where`, a malformed anchor) is refused at create and update with 422, not at approval.
- **A removed row leaves open requests.** When an entitlement row is soft-deleted, every open `changeEntitlements` request to the same holder drops that id from its `remove`, as its own audited update; a request left with nothing to add or remove is canceled (`apps/api/src/hooks/entitlementChangeRequests/hook.ts`). The request being approved is left as it was asked (it is the resolve's `sourceInquiryId`). A deleted holder cancels its open requests through the cascade (see *Data Model*).
- Member rows also hold entitlements but are not targets yet: an inquiry addressed to a member is the member's to read, and a member does not administer their own row, so nobody who could answer would see it.

### Transferring a space

Approving a transfer moves the space, its members and everything downstream into the target org, in the resolution transaction. A member who already belongs to the target org keeps their membership. Every other member is removed; their space membership and its rows move to the target org as tombstones, and hiring them there later does not bring the space back. Nobody becomes a live member of an org they didn't join.

1. The space is locked (`db.findForUpdate`). Its slug in the target org is the resolution's `slug` when the approver gives one (a rename, read from the response), else its current slug. A slug the target org already holds, or an open `createSpace` request for it, refuses the transfer with a 409 (`validateSpaceSlugFree`, shared with `createSpace` and `updateSpace`). The target org's Review dialog offers the rename.
2. One update tombstones every live `SpaceUser` whose user is not a live member of the target org, stamped with the transfer time; `softDeleteCascade` tombstones what they owned and deletes their tokens.
3. Every space member, live or tombstoned, gets a tombstoned `member` row in the target org unless they already have one (`skipDuplicates`): the `SpaceUser` → `OrganizationUser` key needs it once step 4 re-keys their space membership. Its stamp is one no space membership carries, so hiring the person revives only their org membership. Putting them back in the space is a manual re-add; the transfer revives nothing.
4. `Space.organizationId` is set. Every row keyed to the space or a space member carries the org in a composite key (`SpaceUser`; Integration, Token, EmailTemplate and EmailComponent; Inquiry and AuditLog rows keyed to a space member), so one statement re-keys them all by `ON UPDATE CASCADE`; Postgres runs every cascade of a statement before it checks the keys. `spaceKeys.test.ts` (`packages/db/src/registries`) fails when a Space- or SpaceUser-owned model carries an org column outside such a key.
5. The rows the cascade re-keyed are cleared from the cache (`clearSpaceRowCaches`, through `queueCacheClear`). It finds them through every cached model's composite relation to `Space` or `SpaceUser` (`spaceKeyColumns`), so a prefixed pair such as `sourceSpaceId`/`sourceOrganizationId` counts; a space reference without an org column isn't re-keyed and is left alone.

No row keyed to the space keeps the old org's membership, so reviving a membership in the old org revives nothing in the moved space. Audit rows record their context (`contextOrganizationId`) as it was when written, so the space's earlier history stays filed under the old org.

**Who may send and resolve, by type** (declared in `INQUIRY_TYPES`):

| Type | Send (source) | Resolve (target) |
|------|---------------|------------------|
| `inviteOrganizationUser` | Organization `own` for a high role (owner/admin), `manage` otherwise | User `manage` |
| `createSpace` | Organization `own` | The platform (superadmin) |
| `updateSpace` | Space `own` (a space owner, or an org owner through `space.own → org.own`) | The platform (superadmin) |
| `transferSpace` | Space: `own` on the space's organization (`{ rel: 'sourceSpace.organization', action: 'own' }`) | Organization `own` |

`updateSpace` and `transferSpace` differ intentionally. `updateSpace` asks `own` on the space, which an org owner also holds. `transferSpace` is a rule with a dot-path `rel` to the space's organization, so the check is `own` on the organization itself: a space owner alone cannot transfer it.

## Response Schemas

There is one response, `inquiryResponseSchema` (`InquiryItem`, `modules/inquiry/schemas/inquiryResponseSchemas.ts`), with one Prisma include, `includeInquiryResponse` (`queries/inquiryIncludes.ts`): both sides in full (user, organization, space, integration, token, project) and `auditLogsAsSubject`. Every read, list and mutation returns it. A token is returned without its `keyHash`. Why: a row addressed to a token or an integration is only readable in a list when the row shows that record and its owners, whichever side the reader is on (Aron, 2026-11-16: "We should make everything a full response").

## Permissions (ReBAC)

| Action | Who can perform it |
|--------|--------------------|
| `read` | Party-wide, whatever the type, each party on its own channel (`INQUIRY_READ_LEVELS`): a person reads the sides that name them (`read` on that user): what belongs to a member, or chains through one, is the member's and never the organization's; `manage` on an organization reads the sides on the organization alone (no space, no person); `manage` on a space reads the sides on the space with no person |
| `send` | The source party's declared `send` level for that type (table above) |
| `resolve` | The target party's declared `resolve` level for that type; a platform (`admin`) target has no relation, so only a superadmin resolves it |

Reading is by ownership channel because carried keys put the organization on every row beneath it. An organization's managers see what is the organization's, including its own integrations and tokens; a member's own integration is the member's, and a space's inquiries are the space's (Aron, 2026-11-16). Seeing is not resolving: `resolve` stays the per-type level. An inquiry entitlement by a tenant path (`targetOrganization`) admits every kind that carries the key, so a grant kept to the tenant's own channel says so in its `where` (`targetSpaceId` and `targetUserId` equal null); without it the granter must be able to read every kind the path reaches.

`db:inquiry` is the `inquiry` object built by `inquiryPermission(INQUIRY_TYPES)` and imported into the schema: each send and resolve branch is gated on the type and on the party model, then asks the declared action on the relation named for the side and model (`sourceOrganization`, `targetUser`). A level is an action of that model's own resource (a test checks it exists), or a plain rebac rule (`rel`, `any`, `all`, `rule`) used as written, for a case one action cannot say: an invite's role, a dot-path to a related model.

## Adding a New Handler

1. Declare the type's parties and their `send` / `resolve` levels in `INQUIRY_TYPES` (`packages/permissions/src/rebac/inquiryTypes.ts`); the record is keyed by `InquiryType`, so a new type does not compile until it does
2. Create `handlers/<type>/index.ts` implementing `InquiryHandler<TContent, TResolution>`
2. Define `contentSchema` (stored on create) and `resolutionInputSchema` / `resolutionSchema` (validated on resolve) in `packages/shared/src/inquiry/<type>.ts`, so web/admin type `inquiry.content` with the same schema the API parses; `baseResolutionInputSchema` lives there too
   - `resolutionInputSchema` — the copy the resolver sends back, parsed and passed to `handleApprove` as `response`; nothing in it is merged into `content`
   - `resolutionSchema` — full stored shape; extend `resolutionInputSchema` with any computed fields returned by `handleApprove`
   - If no computed fields, both can be the same schema
3. Implement `handleApprove(c, inquiry, content: TContent, response: TResolutionInput)` — runs side effects; return partial resolution output (merged into stored `resolution`)
4. Implement `autoApprove(inquiry)` — required; called immediately after send; return `true` to resolve as approved without human review, `async () => false` otherwise. Future: organizations may configure this via JSON rules stored on the organization record.
5. Add `validate(inquiry, content: TContent)` for pre-create/pre-update business-rule checks (slug collisions, membership checks, etc.)
6. Set `defaultExpirationDays` if the inquiry should auto-expire (e.g. `30` for invitations). Drives `computeExpiresAt` on send and changesRequested. Omit for no expiry.
7. Set `unique: 'targeted'` (one per source+target+type) or `unique: 'untargeted'` (one per source+type regardless of target) if uniqueness should be enforced — automatic
8. Register in `handlers/index.ts`
9. Add the new type to `InquiryType` enum in `packages/db/prisma/schema/inquiry.prisma`
10. Run `bun run db:generate` in `packages/db/`
11. Add a `send` permission rule in `packages/permissions/src/rebac/schema.ts`. If the source is a `User` (not an org or space), add the type string to the `value: []` list in the existing `rel: 'sourceUser'` rule block so the source user can cancel/edit/re-send from any context.

### Status utilities (`validations/validateInquiryStatus.ts`)

| Export | Used in | Meaning |
|--------|---------|---------|
| `inquiryTerminalStatuses` | Prisma `status: { notIn: ... }` queries | `[approved, denied, canceled]` — closed states |
| `validateInquiryIsEditable` | update controller | draft, sent, or changesRequested |
| `validateInquiryIsSendable` | `sendInquiry` | draft or changesRequested |
| `validateInquiryIsResolvable` | `resolveInquiry` (inside its row-locked txn) | sent or changesRequested |
| `validateInquiryNotExpired` | editable and resolvable checks | 410 when `expiresAt` is past |
| `validateInquiryIsCancelable` | cancel controller | not yet in a terminal state |

### Create route permission pattern

Create routes do **not** use `validatePermission` middleware. Permissions are checked granularly inside the controller via ReBAC after synthesizing the inquiry partial:

```typescript
const partial = await hydrate('inquiry', { id: '', type, content, ...source, ...target });
if (!check(permix, rebacSchema, 'inquiry', partial, 'send')) throw makeError({ status: 403, ... });
```

This allows per-type permission rules (e.g. `inviteOrganizationUser` with a high role requires `own`, not just `manage`) without redundant middleware.

## Frontend

### Constants and utilities (`packages/ui/src/lib/inquiries/queryKeys.ts`)

```typescript
// Backend terminal statuses — does NOT include expiry
export const INQUIRY_TERMINAL_STATUSES: InquiryStatus[] = ['approved', 'denied', 'canceled'];

// Frontend terminal check — also treats past-expiresAt as terminal
export const isTerminalInquiry = (inq: { status: InquiryStatus; expiresAt?: string | null }): boolean => {
  if (INQUIRY_TERMINAL_STATUSES.includes(inq.status)) return true;
  if (inq.expiresAt && new Date(inq.expiresAt) < new Date()) return true;
  return false;
};

// Tailwind class string per status (+ synthetic 'expired' key)
export const INQUIRY_STATUS_COLORS: Record<InquiryStatus | 'expired', string>;

// Human-readable labels per type
export const INQUIRY_TYPE_LABELS: Record<InquiryType, string>;
```

`isTerminalInquiry` differs from `inquiryTerminalStatuses` (backend): the frontend also treats an expired inquiry as terminal so controls disable immediately without a server round-trip.

### Query key invalidation maps

```typescript
// Keys to invalidate when the SOURCE side mutates (cancel/delete)
export const sourceMutations: Record<InquiryType, (inq: InquiryMeta) => QueryKey[]>;

// Keys to invalidate when the TARGET side mutates (resolve/approve/deny)
export const targetMutations: Record<InquiryType, (inq: InquiryMeta) => QueryKey[]>;
```

Each handler that resolves in a list (e.g. `transferSpace` received by an org) must add the relevant query key to `targetMutations` so the list refetches after approval.

### `useInquiryPermission`

```typescript
// packages/ui/src/hooks/useInquiryPermission.ts
useInquiryPermission(
  inquiry: CheckableInquiry, // { type, sourceModel, targetModel, content? }: a stored inquiry, or a draft
  action: ActionRule,
  side: 'source' | 'target',
): boolean
```

Side-aware permission check. `side` determines which side of the inquiry the current tenant context fills:

- `'source'` — fills `sourceUser` / `sourceOrganization` / `sourceSpace` from tenant context (used in sent-list views and send forms)
- `'target'` — fills `targetUser` / `targetOrganization` / `targetSpace` from tenant context (used in received-list views)

The inquiry object carries the other side's FK data. This is needed because inquiries only partially hydrate relations in list responses (sent = targets only, received = sources only).

`db:inquiry` gates every send and resolve branch on `sourceModel` / `targetModel`, so a check needs both models and the type. A form that offers sending an inquiry not yet created passes a draft (`{ type: 'transferSpace', sourceModel: 'Space', targetModel: 'Organization' }`). Where the parties come from a prop or the check runs per option (the invite form checks each role), build the record with `inquiryCheckRecord(inquiry, side, parties)` (`packages/ui/src/lib/inquiries/inquiryCheckRecord.ts`), the builder the hook uses, and pass it to `checkPermission`. Never hand-roll the record.

### UI Components

#### `InquirySourceControls`

```typescript
// packages/ui/src/components/inquiries/InquirySourceControls.tsx
<InquirySourceControls inquiry={InquiryItem} size? />
```

Renders Edit / Send / Cancel buttons for the source side. Buttons are conditionally shown based on `isTerminalInquiry` and status:
- **Edit** — visible when not terminal and the type registers a `source.compose` component (opens it)
- **Send** — visible when status is `draft` or `changesRequested`
- **Cancel** — visible when not terminal and status is `sent` or `draft`

All buttons are disabled when `useInquiryPermission(inquiry, 'send', 'source')` is false or the row is still the optimistic placeholder.

#### `InquiryTargetControls`

```typescript
// packages/ui/src/components/inquiries/InquiryTargetControls.tsx
<InquiryTargetControls inquiry={InquiryItem} size? />
```

Renders Approve / Decline buttons, plus Review when the type registers a `target.review` component. Visible when not terminal and status is `sent` or `changesRequested`. Disabled when `useInquiryPermission(inquiry, 'resolve', 'target')` is false.

#### Per-type UI registry (`packages/ui/src/lib/inquiries/registry.ts`)

`registerInquiryType(type, { label, source?, target? })` registers a type's components: `source.summary` / `detail` / `compose` and `target.summary` / `detail` / `review`. Registrations live in `lib/inquiries/registrations/<type>.tsx`; list pages and the controls read them through `getInquiryInterface(type)`.

### Pages

| Page | Location | Description |
|------|----------|-------------|
| `InquiriesPage` | `packages/ui/src/pages/InquiriesPage.tsx` | Sent or received inquiries (`direction`, optional type `filters`) for the current context, via `sentInquiryContextQueries` / `receivedInquiryContextQueries` |
| `AdminInquiriesPage` | `packages/ui/src/pages/AdminInquiriesPage.tsx` | Admin view — all inquiries paginated |
| `SpaceUpdateInquiryPage` | `packages/ui/src/pages/SpaceUpdateInquiryPage.tsx` | Draft/edit/send a `updateSpace` inquiry |
| `SpaceTransferInquiryPage` | `packages/ui/src/pages/SpaceTransferInquiryPage.tsx` | Draft/edit/send a `transferSpace` inquiry |
| `OrganizationSentInvitationsPage` | `packages/ui/src/pages/OrganizationSentInvitationsPage.tsx` | `InquiriesPage` with `direction="sent"` filtered to `inviteOrganizationUser` |

`UserReceivedInvitationsPage`, `OrganizationSpaceApplicationsPage` and `OrganizationIncomingTransfersPage` are the same kind of filtered `InquiriesPage`.
