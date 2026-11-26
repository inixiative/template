# FEAT-034: Integration families as a first-class model

**Status:** Agreed in principle (Aron, 2026-11-26: "integration family becomes first class model right?"; "sounds good make it so"). Design for review; not started.
**Repos:** `inixiative/integrations` (the catalog), `inixiative/template`, then Kingdom.
**Related:** FEAT-029 (settings pages and provider families), template#338 (setting trees, `family:` kind branches).

## Why

A family is one consent and one credential shared by several products: Google for Drive and Gmail, GitHub for its user and organization apps, Atlassian for Jira and Confluence, inixiative for Chorus and Oracle. Kingdom models a family as an `Integration` row (provider `google`) with products pointing at it through `familyIntegrationId`. That shape keeps needing special cases:

- `renewFamilyCredential` refuses anything but `google`.
- The family's unique index applies only `where provider = 'google'`.
- The family "integration" has no operations of its own.
- Family rows need an `organizationId`, so a personal or space owner can't hold one, though Chorus is one per owner of any kind.

Settings now branch on `family:` (template#338), so the model they depend on belongs in template.

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
// a provider names its family: { key: 'jira', family: 'atlassian', … }
```

- **Owner:** any owner, under the same false polymorphism as `Integration`. The family's owner and its products' owner must match. The tenant-boundary hook checks that, as `projectIntegrationOwner` does for links.
- **One per owner per family.** Connecting a product finds or creates the owner's family first, which is the one-per-owner revive path (`createIntegration`, R-2026-11-24-03).
- **Lifecycle:** a family is a soft-delete parent of its products. Removing it removes them, and reviving it revives them.
- **Settings:** `IntegrationFamily` joins `SettingResourceModel` with its own tree, for what the whole family shares (`atlassian.cloudId`, `inixiative.region`). Products keep their `family:` / `provider:` branches on the Integration tree. `settingResourceKindsOf` reads `family` from the product's catalog entry, as it does now.
- **Permissions:** `db:IntegrationFamily` follows `db:Integration`'s owner rules. Products reach their family upward (`IntegrationFamily → owner`), so a family's `manage` is its owner's.

## Credentials (Kingdom)

- **A family product's credential hangs off its `IntegrationFamily`.** Kingdom's `Credential` gets a polymorphic parent: `integration` or `integrationFamily`, with a dual id per R-2026-11-17-04. A product without a family keeps its own.
- **One renewal path per family,** chosen from the catalog's family entry. It replaces the Google-only `renewFamilyCredential`.
- **Direct credentials on a family product are refused** (today's `isFamilyManaged` check), and the 400 names where to go: `{ family: 'atlassian', integrationFamilyId }`, so the UI can send you to connect the family.
- **A family with no credential is valid** (`inixiative`): it groups, shares settings, and turns its products off together.
- **Entitlements:** whatever is anchored at a Kingdom family `Integration` today moves to the `IntegrationFamily`, for example a Signet granting `operate`.

## Cut-over

- **Hard cut, no compatibility.** Kingdom's `familyIntegrationId` and the family `Integration` rows go. Prod is pre-users: reseed, or a one-off step that keeps the Google rows.
- `isFamilyManaged` becomes "the provider names a family".
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
| Catalog | `@inixiative/integrations` (`findProvider`, `isFamilyManaged`, `familyProducts`) |
