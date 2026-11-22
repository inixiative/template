# FIN-001: Financial System — Fiat Billing

**Status**: 🚧 In Progress (Template implementation on `feat/billing-fiat`)
**Priority**: High
**Updated**: 2026-11-22

---

## Overview

Pure fiat billing foundation in `template` (backported to `kingdom`): payment accounts, provider-agnostic adapter (`BillingClient`, Polar.sh first), granular resource-to-account bindings (`BillingResource`), governance & sharing `Setting`s, retry-safe inbound webhooks, and metered usage ingestion.

**Explicitly out of scope:** feature gating (waits for `FEAT-003` feature flags targeting billing state via segments), custom card forms, custom invoice PDFs, and delegated multi-seller Connect billing.

## Settled Design Decisions

- **Generic adapter (`apps/api/src/lib/billing/`):** `BillingClient` behind `makeAdapterRegistry` (dispatch existing accounts/webhooks by `account.provider`) + `resolveAdapterForEnvironmentOrThrow` (pick default provider for new accounts).
- **Polar.sh first adapter (`client/polar.ts`):** Merchant of Record, verified live against `sandbox-api.polar.sh`:
  - Uses Polar `type: 'team'` customers (`owner: { email, name, external_id: '<accountId>:owner' }`), allowing multiple `BillingAccount`s to share one `billingEmail` without duplicate-email errors.
  - Uses `$0` metered-only product checkout (`is_payment_setup_required: true`) for one-time card capture and `POST /v1/customer-sessions/` (`external_customer_id` + `external_member_id`) for zero-login Customer Portal access.
  - Uses Standard Webhooks HMAC-SHA256 verification and `POST /v1/events/ingest` with `external_id` idempotency.
- **5-owner `BillingAccount`:** Owned by `User | OrganizationUser | Organization | Space | SpaceUser`, N accounts per owner, exactly one `isDefault: true` while ≥ 1 live account exists. Deleting the very last account is allowed (soft-deleted + async `cancelBillingAccount` job + `billingAccount.statusChanged` event). All enums are camelCase (`incomplete | active | pastDue | expired | canceled`; `inherit | off | on`).
- **Unified `BillingResource`:** Binds a `BillingAccount` to `Space | OrganizationUser | SpaceUser | Project | ProjectIntegration` (`resource*`-prefixed columns) with strict owner containment (no cross-org or `User → Organization` bindings).
- **Visibility & sharing:** Accounts are private by default (`sharing: inherit | off | on` + owner `billing.shareAccountsWithMembers` setting synced into `isShared` for ReBAC/Prisma/UI). Private accounts can still be granted selectively via `Entitlement` (`operate`).
- **Fixed resolution walk:** `ProjectIntegration → Project → SpaceUser → OrganizationUser → Space → Organization` (and `User` path), gated by 4 governance `Setting` edges (`billing.allowSpaceBilling`, `billing.allowOrgUserBilling`, `billing.allowSpaceUserBilling` on `Space` + `OrganizationUser`).

See [docs/claude/BILLING.md](../docs/claude/BILLING.md) for the live implementation reference.
