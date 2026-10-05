# FEAT-010: Addresses — a Contact type, not a model

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium (FIN-001 billing and any physical fulfilment need it; Zealot paid for the lessons)
**Created**: 2026-02-06
**Updated**: 2026-10-05 (rewritten from the stub; shape decided against Contact, the false-polymorphism registry and INFRA-009)

---

## Overview

A postal address is contact information: it belongs to a User, an Organization or a Space, there
can be several per owner with roles (billing, shipping, home, business), one is primary, it has a
canonical form for dedupe, it can be verified, and it must be redactable. `Contact` already models
exactly that for phones, emails and handles — false-polymorphic owner, `type` + `subtype`, `label`,
`position`, typed JSON `value` with a `valueKey` projection, `verifiedAt`, `source`, `redact`,
per-owner uniqueness, audit through the lifecycle. Addresses are one more `ContactType`, not a new
table with its own owner columns, its own uniqueness and its own CRUD.

What is genuinely new is three things: a structured address value with country-aware validation,
an adapter for the external validation / geocoding provider, and making the parts a rule can read.

## Shape

### 1. `ContactType.address`

- `type: address`; `subtype` **required** from `ADDRESS_SUBTYPES = ['billing', 'shipping', 'home', 'business']`
  (the stub's "address types" are subtypes, the way phone has mobile/work). Primary = `position 0`
  per subtype, which Contact already orders by.
- `value` (`AddressValue`), the stored canonical shape, field names from Google's libaddressinput
  so the per-country metadata (below) applies without a mapping layer:

  ```ts
  type AddressValue = {
    country: CountryCode;              // ISO-3166-1 alpha-2 — @template/shared/reference/countries
    addressLines: string[];            // 1–3 lines, street number + route + unit
    locality?: string;                 // city / town
    dependentLocality?: string;        // neighbourhood / district, where the country uses one
    administrativeArea?: string;       // state / province / region — code where the country has them (US-CA → 'CA')
    postalCode?: string;
    sortingCode?: string;              // CEDEX etc.
    recipient?: string;                // name on the label — shipping only
    organization?: string;             // company on the label
    formatted?: string;                // provider's one-line rendering, display only
    geo?: { lat: number; lng: number };// set by the validation adapter, never by input
    validatedAt?: string;              // ISO; the adapter's verdict stamp. Absent = user-entered, unverified
  };
  ```

- `inputSchema` is loose: the structured object above, **or** `{ freeform: string, country?: CountryCode }`
  for a pasted address; `parseInput` normalises either into `AddressValue` (freeform goes through
  the adapter's `parse`, see §3). `valueSchema` is strict.
- `toValueKey`: `country|postalCode|normalised lines|locality` — upper-cased, diacritics stripped,
  whitespace and punctuation collapsed. Two spellings of one address dedupe; the per-owner unique
  on `(ownerFk, type, valueKey)` already exists.
- `uniqueness: 'per-owner'`. Two owners may share an address (a founder and their company).
- `redact`: lines → `['[redacted]']`, locality/postal/geo/recipient dropped, `country` kept
  (an aggregate fact, not PII on its own).
- `display: { label: 'Address', icon: 'lucide:map-pin' }`. No `toUrl`, no `toStubEmail`.

### 2. Country-aware validation — metadata, not hand-written rules

Which fields a country requires, what it calls them (ZIP vs Postcode, State vs Province vs
Prefecture), how it orders them, and the postal-code pattern come from libaddressinput's open
metadata (`i18napis.appspot.com/address` dataset, vendored as JSON into
`packages/shared/src/reference/addressFormats.ts` the way `countries.ts` vendors ISO-3166).
`valueSchema` is refined per `country` from that table: required fields present, postal code
matches the pattern, `administrativeArea` in the country's list when it has one. The same table
drives the FE form (labels, order, which fields show) — one source for validation and rendering,
no per-country code.

### 3. The address adapter (INFRA-009)

Validation and geocoding talk to a third party, so they are an adapter with an interface, a
provider implementation and a console/mock implementation, picked at `init`:

```ts
type AddressClient = {
  parse(freeform: string, hint?: { country?: CountryCode }): Promise<AddressValue | null>;   // paste → structured
  validate(value: AddressValue): Promise<{ value: AddressValue; verdict: 'confirmed' | 'corrected' | 'unconfirmed' }>;
  suggest(prefix: string, hint?: { country?: CountryCode }): Promise<AddressSuggestion[]>;  // autocomplete
};
```

- First provider: **Google** (Geocoding for `parse`/`validate`, Places Autocomplete for `suggest`).
  Zealot's `integrations/googleGeocode/api.ts` is the client to port — embedded VCR, cassette per
  test, never touches `globalThis.fetch`. Second provider when a consumer needs it (Loqate, Smarty);
  the interface is the investment.
- The component → field normaliser ports from Zealot's `createShippingAddress` **with its fallbacks
  intact**, each one a bug that reached production: `postal_town` when `locality` is missing (UK,
  ZLT-2463 — a carrier rejected the shipment for a missing city), `administrative_area_level_3` with
  the trailing " City" stripped, non-Latin components skipped in favour of a Latin one, province
  recovered from the raw string when the provider returns none, street recovered from the raw string
  when the provider drops the route. `validate` returns `corrected` when it changed anything, and
  the FE shows the correction rather than silently overwriting what the user typed.
- `geo` and `validatedAt` are written only by `validate`. A user edit to any address field clears
  both, so a stale verification can never outlive the address it verified.
- Validation runs in the write path of the Contact service (`parseInput` for freeform, `validate`
  on save when the adapter is configured), never in a hook — same ruling as segment reconcile:
  external calls belong where the request can report them, and a provider outage must degrade to
  "saved, unverified", not to a failed save.

### 4. What a rule can read

Segmenting by country or region is the first thing anyone wants and the JSON value is not a
lens path. Two indexed scalar columns on `Contact`, written by the Contact service from the value
on every save:

- `country CountryCode?` — populated for `address` **and** `phone` (phone already carries it in
  `value`), so "customers in Germany" is `contacts.country` whichever contact type says so.
- `region String?` — `administrativeArea` for addresses; null otherwise.

Both join the customer lens as filterable paths on `contacts` narrowed by `type`. Postal-code
prefix and geo-radius rules are **not** in scope; if they are wanted they are derived enrichments
(FEAT-020), not more columns.

### 5. Consumers take a snapshot, not a reference

A redemption, an invoice or a shipment keeps **its own copy** of the address value as it was at the
moment of use (`Json` column, `AddressValue` shape), never an FK to the Contact row. The owner edits
or deletes their address later; the record of what was billed or shipped must not move with it.
Zealot's `DirectRewardRedemption` already does this, in flat columns; the template does it as one
JSON column with the same schema, so the renderer is shared.

### 6. History

Nothing new. Contact writes go through the lifecycle and land in `AuditLog` with before/after; the
"address change tracking" the stub asked for is a query on the audit log, not a table.

## Not in scope

- Tax and shipping-rate calculation (FIN-001 / a fulfilment ticket consume the billing and
  shipping subtypes; they do not live here).
- A second validation provider before a consumer asks for one.
- Postal-code prefix or geo-radius segmentation (derived enrichments, FEAT-020).
- Localized display of foreign scripts beyond what the provider returns (FEAT-006).

## Zealot lessons folded in

- Free-text `address VARCHAR(100)` + `zipCode VARCHAR(100)` on `FanUsers`, re-parsed by the geocoder
  at every shipment: parse once at save, store structured, verify, snapshot at use.
- `IntegrationMap`'s "`02109` is a postal code, not the number 2109": postal codes are strings
  end to end; the value schema never coerces them.
- Missing-city carrier rejections and non-Latin locality names: the fallbacks in §3 are the
  normaliser, not optional polish.
- `createShippingAddress` swallowing every error into `null`: here a provider failure is a logged
  `unconfirmed` verdict and the address saves unverified.

## Tests

- `addressDef`: freeform US / UK / JP / DE parse into the canonical shape (cassettes); valueKey
  dedupes "123 Main St." and "123 main street"; per-country required fields and postal patterns
  refuse and accept as the metadata says; redaction keeps `country` only.
- Adapter: each `createShippingAddress` fallback reproduced as a cassette-driven case; `corrected`
  verdict when the provider changes a component; provider error → `unconfirmed`, save succeeds.
- Contact service: `country`/`region` columns follow the value on create, update and the clear on
  edit; `validatedAt`/`geo` cleared by an edit to any address field.
- Lens: a segment rule on `contacts.country` with `type: address` compiles on both rails and
  matches the expected customers.
- Snapshot: a consumer's stored copy is unchanged after the owner edits the Contact.

## Related

- **Blocks**: FIN-001 (billing address), any physical fulfilment.
- **Rides on**: Contact registry (`packages/shared/src/contact/`), false-polymorphism registry,
  INFRA-009 adapter primitive, `reference/countries.ts`.
- **Feeds**: FEAT-021 segments (the two columns in the lens), FEAT-020 (anything finer than region).
