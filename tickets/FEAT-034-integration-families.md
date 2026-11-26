# FEAT-034: Integration families as a first-class model

**Status:** Agreed in principle (Aron, 2026-11-26: "integration family becomes first class model right?"; "sounds good make it so"). Design for review; not started.
**Repos:** `inixiative/integrations` (the catalog), `inixiative/template`, then Kingdom.
**Related:** FEAT-029 (settings pages and provider families), template#338 (setting trees).

## Why

A family is one consent and one credential shared by several products: Google for Drive and Gmail, GitHub for its user and organization apps, Atlassian for Jira and Confluence, inixiative for Chorus and Oracle. Kingdom models a family as an `Integration` row (provider `google`) with products pointing at it through `familyIntegrationId`. That shape keeps needing special cases:

- `renewFamilyCredential` refuses anything but `google`.
- The family's unique index applies only `where provider = 'google'`.
- The family "integration" has no operations of its own.
- Family rows need an `organizationId`, so a personal or space owner can't hold one, though Chorus is one per owner of any kind.

Template has no family model, so family-wide settings have nowhere to live; it belongs in template.

## Shape

```prisma
model IntegrationFamily {
  id        String    @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  family String // catalog family key: google, github, atlassian, inixiative

  ownerModel     IntegrationOwnerModel
  userId         String? @db.VarChar(36)
  organizationId String? @db.VarChar(36)
  spaceId        String? @db.VarChar(36)

  integrations Integration[]
  settings     Setting[]

  @@unique([ownerModel, organizationId, spaceId, userId, family], where: raw("\"deletedAt\" IS NULL"))
}

model Integration {
  // ...
  integrationFamilyId String?            @db.VarChar(36)
  integrationFamily   IntegrationFamily? @relation(fields: [integrationFamilyId], references: [id], onDelete: Restrict)
}
```

```ts
// @inixiative/integrations: families are their own catalog entries, not providers
export const families = [
  { key: 'google', oauth: { … } },
  { key: 'github', oauth: { … } },
  { key: 'atlassian', oauth: { … } },
  { key: 'inixiative' },
] as const;
// a provider names its family: { key: 'jira', integrationFamily: 'atlassian', … }
```

- **Owner:** any owner, under the same false polymorphism as `Integration`. The family's owner and its products' owner must match. The tenant-boundary hook checks that, as `projectIntegrationOwner` does for links.
- **One per owner per family.** Connecting a product finds or creates the owner's family first, which is the one-per-owner revive path (`createIntegration`, R-2026-11-24-03).
- **Lifecycle:** a family is a soft-delete parent of its products. Removing it removes them, and reviving it revives them.
- **Membership is a column on the product.** `Integration.integrationFamily` is an optional `IntegrationFamily` enum (`google`, `github`, `atlassian`, `inixiative`), mirrored from the catalog the way `Provider` is.
  - On create it defaults to the catalog's family for the provider: Jira gets `atlassian`, Slack gets null. A custom integration (no provider) may name a family, or none.
  - It can't change after create (immutable-fields registry, as `provider`). Settings stored under one family's branch would otherwise fall off the tree.
- **Settings: two records, two trees, no nesting** (Aron, 2026-11-26: "integration and integration family are different tables in the tree now, and the nesting should just go away").
  - `IntegrationFamily` joins `SettingResourceModel` with its own tree, for what the whole family shares (`atlassian.cloudId`, `inixiative.region`).
  - The Integration tree keeps only `provider:` branches.
  - No `integrationFamily:` kind: template#338 removed it.
- **Permissions:** `db:IntegrationFamily` follows `db:Integration`'s owner rules. Products reach their family upward (`IntegrationFamily → owner`), so a family's `manage` is its owner's.

## UI: the family has its own settings page

An integration's settings page links to its family's ("Family settings"). That page is a route of its own, `/settings/integrations/families/:id`, and isn't in the nav. It renders the `IntegrationFamily` record's tree with `SettingTreeView`, so each page shows one resource.

At the top of the family page, a strip shows every product of the family as an icon, so you can see what its settings touch:
- active products in colour, the rest greyed out;
- a small count badge on an icon when the owner has more than one of that product.

The other option was to show the family's settings at the top of each integration's page. That puts two resources on one page.

## Credentials: each provider's `authMethods` is the one gate

Aron, 2026-11-26: "I don't know why we would refuse direct credentials. We have several credential modes, probably, and each integration should support its list of credentials. Then you could add any credential from that list."

- **`ProviderDefinition.authMethods` decides which credentials an integration takes, family or not.** `integrationCreateCredential` and `credentialUpdate` already check it; the `isFamilyManaged` refusal in front of that check goes. `githubUser` lists `['oauth2', 'bearer']` today and is still refused a pasted bearer, which is the contradiction.
- **How a method is added depends on the method, not on the family.** `bearer`, `apiKey` and `clientCredentials` are entered directly. `oauth2` comes from a consent flow: through the family's consent when the provider has a family (Drive through Google), the provider's own otherwise (Slack).
- **The connect UI offers every listed method.** A family product shows "Connect with Google" for `oauth2` beside any method it can take directly.

No settings for this in the MVP (Aron, 2026-11-26: "For MVP, we do not need it"). If an owner later needs to turn a method off, a `connection` branch in the Integration tree could hold it, for example `connection.directCredentials` (boolean). These would be settings rather than columns because they only change which credential is used, not which settings exist. A custom integration using another family's auth is already expressible by setting `integrationFamily` at create.

## Credentials (Kingdom)

- **The family's consent credential hangs off its `IntegrationFamily`.** Kingdom's `Credential` gets a polymorphic parent: `integration` or `integrationFamily`, with a dual id per R-2026-11-17-04. Credentials entered directly on a product stay on the product.
- **One renewal path per family,** chosen from the catalog's family entry. It replaces the Google-only `renewFamilyCredential`.
- **An `oauth2` credential on a family product comes from the family's consent.** Asking for one on the product returns a 400 that names where to go: `{ integrationFamily: 'atlassian', integrationFamilyId }`, so the UI can send you to connect the family. Other listed methods are entered on the product.
- **A family with no credential is valid** (`inixiative`): it groups, shares settings, and turns its products off together.
- **Entitlements:** whatever is anchored at a Kingdom family `Integration` today moves to the `IntegrationFamily`, for example a Signet granting `operate`.

## Cut-over

- **Hard cut, no compatibility.** Kingdom's `familyIntegrationId` and the family `Integration` rows go. Prod is pre-users: reseed, or a one-off step that keeps the Google rows.
- `isFamilyManaged` and `familyManagedCredentialMessage` go, with every refusal that calls them (`integrationCreateCredential`, `credentialUpdate`, `credentialRevoke`, `integrationSchemas`, and the web filters in `AddIntegrationForm`, `IntegrationSetup`, `IntegrationMaintenance`, `integrationProviders`). `authMethods` is the gate.
- Products are refused while their family is down. That replaces `familyIsLive`.

## Open

- **Chorus and Oracle under `inixiative`.** This means one consent flow for our own products. Kingdom hosts them, and the model capacity is the customer's own API key, so the family may hold no credential: it would be a grouping plus a shared off switch. Agreed in principle; confirm when the catalog entry lands.
- **Atlassian.** Jira and Confluence share one OAuth app and site (`cloudId`), so a family fits as it does for Google.

## Existing primitives used

| Concern | Primitive |
|---|---|
| Owner columns | `PolymorphismRegistry.Integration` (`polymorphicAxis`, `polymorphicKeyColumns`), extended to `IntegrationFamily` |
| One per owner, revive | `createIntegration` (find the one row with `db.findForUpdate(..., { upserting: true })`, then update, revive or create) |
| Lifecycle | the soft-delete cascade (`apps/api/src/hooks/softDeleteCascade/`) |
| Owner match | the tenant-boundary hook pattern (`projectIntegrationOwner`) |
| Settings | `SETTING_TREES`, `settingResourceKindsOf` |
| Permissions | `db:Integration` rules in `packages/permissions/src/rebac/schema.ts` |
| Catalog | `@inixiative/integrations` (`findProvider`, `familyProducts`) |
| Which credentials an integration takes | `ProviderDefinition.authMethods`, already checked in `integrationCreateCredential` and `credentialUpdate` |
