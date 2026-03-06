# FEAT-001: Inquiry System

**Status**: ✅ Complete
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-03-05

---

## Overview

A generic, type-safe workflow engine for multi-party requests that require review and approval. Handles org user invitations, space creation/update/transfer requests, and is extensible to any future async approval flow.

## What's Built

### Data Model
- `Inquiry` model with explicit fake-polymorphism for source and target (`sourceModel` + FK, `targetModel` + FK)
- `InquiryType` enum: `inviteOrganizationUser`, `createSpace`, `updateSpace`, `transferSpace`
- `InquiryStatus` enum: `draft → sent → approved/denied/changesRequested → canceled`
- `content` (set on create) and `resolution` (set on resolve) as JSON blobs

### API
- **Context-specific create**: `POST /me/inquiries`, `POST /organization/:id/inquiries`, `POST /space/:id/inquiries`, `POST /admin/inquiries`
- **Lifecycle**: `GET`, `PATCH` (update), `POST /send`, `POST /resolve` (approve/deny/changesRequested), `DELETE` (cancel)
- **Lists**: Sent and received per context (me, organization, space) — scoped, paginated, searchable
- **Admin**: `GET /admin/inquiries` — full list with all relations

### Handler System
Each inquiry type has a handler defining source/target config, content/resolution schemas, optional pre-create validation, and a `handleApprove` side-effect. See [INQUIRIES.md](../docs/claude/INQUIRIES.md).

### Permissions (ReBAC)
- `send` — source-side role check (org owner for all space types; org manage for invites)
- `resolve` — target-side manage check; superadmin bypass for `admin` targets
- `read` — either side (source or target) with manage on their respective resource

### Response Schemas
Shared schemas with relation includes:
- `inquiryResponseSchema` — all 6 relations (single read, admin list)
- `inquirySentResponseSchema` — targets only (sent lists, create response)
- `inquiryReceivedResponseSchema` — sources only (received lists)

## What Shipped (Redesign — 2026-03-05)

- `handleApprove` implemented for all 4 types (`inviteOrganizationUser`, `createSpace`, `updateSpace`, `transferSpace`)
- `unique` field changed from `boolean` to `'targeted' | 'untargeted'` enum
- `resolveInquiryTarget` — removed `handler` param, uses `body.targetModel` directly; added org slug + space slug as alt lookups
- `inquiryCreateBodySchema` — added `targetOrganizationSlug`, `targetSpaceSlug`
- `validateInquiryStatus` + `resolveContent` moved out of `services/utils/` — validators → `validations/`, resolveContent → `services/`
- `inviteOrganizationUser` handler consolidated from 4 files into single `index.ts`
- ReBAC `resolve` rule — `transferSpace` now requires target org `own` (not just `manage`)
- `Space.organizationId` excluded from immutable fields hook to allow `transferSpace` to update it
- FEAT-016 stub ticket created for lineage, nesting, metadata, and auto-approval ideas

## Remaining

- Email notifications when inquiry is sent / resolved (blocked by COMM-001)
- Audit log integration for status change history (blocked by FEAT-005)

## Related

- [INQUIRIES.md](../docs/claude/INQUIRIES.md) — full developer reference
- [COMM-001](./COMM-001-email-system.md) — email system (needed for invite notifications)
