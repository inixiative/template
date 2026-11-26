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
// @inixiative/integrations: families are their own catalog entries, with their own authMethods
export const integrationFamilies = [
  { key: 'google', authMethods: ['oauth2'], oauth: { … } },
  { key: 'github', authMethods: ['oauth2'], oauth: { … } },
  { key: 'atlassian', authMethods: ['oauth2'], oauth: { … } },
  { key: 'inixiative', authMethods: [] },
] as const;

// a product names its family, and lists the family as one of its auth methods
{ key: 'drive', integrationFamily: 'google', authMethods: ['integrationFamily'] }
{ key: 'githubUser', integrationFamily: 'github', authMethods: ['integrationFamily', 'bearer'] }
{ key: 'jira', integrationFamily: 'atlassian', authMethods: ['bearer', 'oauth2'] } // membership only until Atlassian consent is supported
{ key: 'slack', authMethods: ['bearer', 'oauth2'] }

// contracts.ts: authMethods is a superset of the stored credential's method
const authMethodSchema = z.enum([...credentialMethodSchema.options, 'integrationFamily']);
// refine: 'integrationFamily' in authMethods requires integrationFamily to be set
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

## Credentials: `authMethods` is the one gate, and the family is one of the methods

Aron, 2026-11-26: "I don't know why we would refuse direct credentials. We have several credential modes, probably, and each integration should support its list of credentials. Then you could add any credential from that list." Then: "the family might have auth methods, or integration might have auth methods… an 'inherit from family' auth method… that's totally valid"; "they are supersets. The credential is what you're actually using. The credential belongs to the integration, depending, right? If you auth through the family, you can use a family credential."

- **Auth methods vs. the credential.** `authMethods` (on a provider and on a family) lists the ways something can authenticate. A `Credential` is what a call actually uses, and its `method` is always a real one (`bearer`, `apiKey`, `oauth2`, `clientCredentials`). `integrationFamily` is an auth method and never a credential's method, so the auth-method enum is a superset of `credentialMethodSchema`.
- **The credential belongs to whatever you authenticated through.** A credential entered on a product hangs off the `Integration`. Connecting through the family puts the credential on the `IntegrationFamily` (Kingdom's `Credential` gets a polymorphic parent, `integration` or `integrationFamily`, with a dual id per R-2026-11-17-04). A product that lists `integrationFamily` may then use its family's credential.
- **Adding a credential.** Every method on the list can be added; nothing in front of the list refuses one. `bearer`, `apiKey` and `clientCredentials` are entered; `oauth2` goes through a consent flow (the product's own OAuth app, for example Jira's or Slack's); `integrationFamily` connects the family through the family's own `authMethods`.
- **Choosing at call time** (`eligibleCredential`): the product's own eligible credential first, then its family's if the product lists `integrationFamily`. The more specific one wins. A credential is checked against `acceptedCredentialMethods(provider)` (the provider's own methods plus its family's), never against `authMethods` directly: Drive's list is `['integrationFamily']`, but the call carries Google's `oauth2`.
- **Renewal follows the owner.** `refreshProviderCredential` takes `{ integrationFamily }` for a family credential and `{ provider }` for one entered on the integration. GitHub user OAuth now comes through the `github` family, so it renews as the family's.
- **The connect UI offers every listed method.** Drive shows "Connect with Google"; `githubUser` shows "Connect with GitHub" beside "Paste a token".
- **A custom integration** that names a family may list `integrationFamily` to use the family's auth.

No settings for this in the MVP (Aron, 2026-11-26: "For MVP, we do not need it"). If an owner later needs to turn a method off, a `connection` branch in the Integration tree could hold it (for example `connection.directCredentials`, boolean). These would be settings rather than columns because they change which credential is used, not which settings exist.

## Credentials (Kingdom)

- **One renewal path per family,** chosen from the family's catalog entry. It replaces the Google-only `renewFamilyCredential`.
- **A family with no auth methods is valid** (`inixiative`): it groups, shares settings, and turns its products off together.
- **Entitlements:** whatever is anchored at a Kingdom family `Integration` today moves to the `IntegrationFamily`, for example a Signet granting `operate`.

## Cut-over

- **Hard cut, no compatibility.** Kingdom's `familyIntegrationId` and the family `Integration` rows go. Prod is pre-users: reseed, or a one-off step that keeps the Google rows.
- `isFamilyManaged` and `familyManagedCredentialMessage` go, with every refusal that calls them (`integrationCreateCredential`, `credentialUpdate`, `credentialRevoke`, `integrationSchemas`, and the web filters in `AddIntegrationForm`, `IntegrationSetup`, `IntegrationMaintenance`, `integrationProviders`). `authMethods` is the gate.
- `credentialAccessWhere` and `eligibleCredential` read the product's credentials, then the family's when the product lists `integrationFamily`, in place of `familyIntegrationId`.
- Kingdom moves to integrations `^0.3.0` in this build, not before (RELEASE-QUEUE row): `authMethods.includes(...)` checks become `acceptedCredentialMethods` (`eligibleCredential`, `accessDescribe`, `credentialUpdate`, `integrationCreateCredential`, `IntegrationSetup` never offers `integrationFamily` as a pasted method); `claimRefreshToken`'s jira/confluence → `atlassian` map and `accessDescribe`'s `providerFamily` read `integrationFamily`; `.family` → `.integrationFamily` (`googleSchemas`, `renewCredential`); `familyProducts` → `providersInIntegrationFamily` (`GoogleSection`).
- Products are refused while their family is down. That replaces `familyIsLive`.

## Open

- **Chorus and Oracle under `inixiative`.** This means one consent flow for our own products. Kingdom hosts them, and the model capacity is the customer's own API key, so the family may hold no credential: it would be a grouping plus a shared off switch. Agreed in principle; confirm when the catalog entry lands.
- **Atlassian.** Jira and Confluence share one OAuth app and site (`cloudId`), so a family fits as it does for Google. integrations 0.3.0 puts them in `atlassian` for grouping and settings only; they list `integrationFamily` once the package supports Atlassian consent (an authorize URL, the JSON code exchange, and reading the account from `accessible-resources`). Until then `isAccountSuppliedByHost` stays false for them, so a Jira with a pasted token keeps its typed account.
- **Account supplied by host is decided per provider, but depends on the credential.** `githubUser` takes the family consent or a pasted bearer; with a pasted token the host supplies no account. Decide in the Kingdom build whether the account comes from the credential path.

## Existing primitives used

| Concern | Primitive |
|---|---|
| Owner columns | `PolymorphismRegistry.Integration` (`polymorphicAxis`, `polymorphicKeyColumns`), extended to `IntegrationFamily` |
| One per owner, revive | `createIntegration` (find the one row with `db.findForUpdate(..., { upserting: true })`, then update, revive or create) |
| Lifecycle | the soft-delete cascade (`apps/api/src/hooks/softDeleteCascade/`) |
| Owner match | the tenant-boundary hook pattern (`projectIntegrationOwner`) |
| Settings | `SETTING_TREES`, `settingResourceKindsOf` |
| Permissions | `db:Integration` rules in `packages/permissions/src/rebac/schema.ts` |
| Catalog | `@inixiative/integrations` 0.3.0 (integrations #4): `integrationFamilies`, `integrationFamilyDefinition`, `providersInIntegrationFamily`, `acceptedCredentialMethods`, `providerAuthenticatesThroughIntegrationFamily`, `refreshProviderCredential({ integrationFamily })`, `exchangeOauthCode({ integrationFamily })` |
| Which credentials an integration takes | `ProviderDefinition.authMethods`, already checked in `integrationCreateCredential` and `credentialUpdate`; extended with `integrationFamily` |
| Which credential a call uses | Kingdom `eligibleCredential` / `credentialAccessWhere` |
