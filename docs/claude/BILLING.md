# Billing (`FIN-001`)

Pure fiat billing infrastructure: payment accounts, provider sync, granular resource-to-account bindings, governance settings, and metered usage ingestion. **No feature gating lives here** — feature flags (`FEAT-003`) target billing state separately via `Segment`s.

## Architecture

### Adapter Layer (`apps/api/src/lib/billing/`)

- `types.ts` defines the provider-agnostic `BillingClient` interface (`ensureCustomer`, `updateCustomer`, `createSetupSession`, `createPortalSession`, `cancelAccount`, `fetchAccountState`, `ingestUsageEvents`, `parseWebhook`) and camelCase status/event types.
- `index.ts` registers provider clients in `billingRegistry` (`makeAdapterRegistry<BillingClient>()`) so existing accounts and inbound webhooks dispatch by `account.provider`, while `defaultBillingClient` (`resolveAdapterForEnvironmentOrThrow`) selects the default provider for newly created accounts.
- `client/polar.ts` is the first concrete adapter (Polar.sh Merchant of Record):
  - Creates Polar `type: 'team'` customers with `owner: { email, name, external_id: '<accountId>:owner' }` so multiple `BillingAccount`s can share the same `billingEmail` with zero duplicate-email collisions.
  - Uses `$0` metered pay-as-you-go checkout (`is_payment_setup_required: true`) for one-time card capture and `POST /v1/customer-sessions/` with `external_customer_id` + `external_member_id` for zero-login Customer Portal links.
  - Verifies inbound webhooks with Standard Webhooks HMAC-SHA256 (`webhook-id`, `webhook-timestamp`, `webhook-signature`), refetches authoritative `/v1/subscriptions/?customer_id=...` state when `customer.state_changed` has empty `active_subscriptions` or a `subscription.*` event targets a non-primary subscription, and preserves cached `paymentMethod*` fields when omitted.
  - Updates Polar customer name and team owner member email on `updateCustomer`.
  - Ingests usage events via `POST /v1/events/ingest` with `external_id` idempotency keys.

### Data Models (`packages/db/prisma/schema/`)

- **`BillingAccount`** (`billingAccount.prisma`): owned by all 5 primary owners (`User | OrganizationUser | Organization | Space | SpaceUser`). Any number of accounts per owner, with at most one live `isDefault: true` (partial unique per owner arm). First account auto-defaults; cannot unset or delete the default while other accounts exist, **can** delete the very last account (soft-deleted + async provider cancellation via `cancelBillingAccount` job + `billingAccount.statusChanged` event). Registered in `SKIP_REVIVE`.
- **`BillingResource`** (`billingResource.prisma`): binds a `BillingAccount` to a granular target (`Space | OrganizationUser | SpaceUser | Project | ProjectIntegration`, all target columns/relations prefixed `resource*`). Enforces strict containment (`billingAccount.owner` equals or contains target) in `apps/api/src/hooks/billingResourceOwner/hook.ts`. Registered in `ParentEdgeRegistry` pointing at `BillingAccount` for `AuditLog` tenancy.
- **`BillingWebhookEvent`** (`billingWebhookEvent.prisma`): append-only (`APPEND_ONLY_MODELS`) inbound idempotency log keyed by `(provider, externalEventId)` with retry-safe claim/reclaim (`processed`/`ignored` → `200`, `failed` or stale `pending` → reclaim, fresh `pending` → `503`).

### Governance, Sharing & Resolution

- **Settings (`packages/shared/src/settings/registry.ts`, category `billing`, all default `false`):**
  - `billing.allowSpaceBilling` (`Organization`)
  - `billing.allowOrgUserBilling` (`Organization`)
  - `billing.allowSpaceUserBilling` (`Space`, `OrganizationUser`) — `SpaceUser` billing also requires at least one org-level delegation flag (`billing.allowSpaceBilling` or `billing.allowOrgUserBilling`) so an Organization with both off strictly enforces org-only billing.
  - `billing.shareAccountsWithMembers` (`Organization`, `Space`)
- **Account sharing & privacy (`BillingAccount.sharing`: `inherit | off | on`):** Organization and Space accounts are hidden from regular members by default (`isShared` synced by `apps/api/src/hooks/billingAccountLifecycle/hook.ts` from `sharing` + owner's `billing.shareAccountsWithMembers`). Private accounts (`isShared: false`) can still be shared selectively via standard `Entitlement`s (`operate`). Member-owned accounts (`User`, `OrganizationUser`, `SpaceUser`) are strictly private to the owning user (org/space owners cannot read or delete them; member removal cascades tombstones via `softDeleteCascade`).
- **Fixed resolution walk (`apps/api/src/modules/billingResource/services/resolveBillingAccount.ts`):**
  `ProjectIntegration → Project → SpaceUser → OrganizationUser → Space → Organization` (or `User`). Explicit `BillingResource` overrides are returned even when `pastDue`/`expired` (no silent fallback to the org card).
- **PII redaction:** `GET /api/v1/billingResource/resolve` checks `read` on the target (returning uniform `403` when absent or unauthorized) and separately checks `read` on the resolved `BillingAccount` and `BillingResource`; callers without `billingAccount:read` receive only `{ resolved, status, source, boundAt, billingResourceId, billingAccount: null }`.
