# FEAT-010: Addresses — its own model; survey the international patterns before designing

**Status**: 🔍 Research
**Assignee**: TBD
**Priority**: Medium (FIN-001 billing and any physical fulfilment need it)
**Created**: 2026-02-06
**Updated**: 2026-10-05 (ruling: Address is its own model, not a Contact type; design waits on a survey)

---

## Ruling (Aron, 2026-10-05)

> "Address needs to be its own thing. I suspect it's so complicated. I've never seen it solved
> correctly. We should probably do some sort of polling on the various solutions to the address
> patterns we can consider for international."

So: an `Address` model with its own owner, lifecycle, shape, editor and query helpers, **not** a `ContactType.address`
(that draft is withdrawn — Contact's one-JSON-value-plus-valueKey shape is right for a phone or a
handle and too thin for the thing that has defeated every CRM). And no schema is designed until the
survey below is done and discussed.

## Step 1 — the survey

Collect, side by side, how each of these represents an international address, what it gets right,
and where it breaks. One table, one row per candidate, same columns: field set, how it handles
countries with no postal code / no street names / non-Latin scripts / sorting codes / dependent
localities, whether it carries per-country format metadata, whether it carries a canonical form
for dedupe, whether it is a standard, a library or a vendor API, and what it costs to adopt.

Standards and schemas:
- **OASIS xAL / CIQ** — the maximalist XML standard; shows the full field space
- **UPU S42** — the postal union's addressing standard; closest to what carriers accept
- **ISO 19160** — addressing conceptual model
- **Schema.org `PostalAddress`** — what the web has converged on
- **HL7 FHIR `Address`** — a pragmatic, widely implemented shape with `use` and `type`
- **vCard `ADR`** — the oldest shipped shape; what every phone exports

Metadata and libraries:
- **Google libaddressinput** — per-country required fields, labels, order, postal regex (open
  dataset); the metadata layer most forms are built on
- **OpenCage `address-formatter`** — the OSM community's per-country formatting templates
- **i18n-postal-address**, **postal-address** (npm) — the formatting libraries built on the above
- **libpostal** — statistical parser/normaliser for free text; the canonical-form candidate

Vendors (validation / autocomplete / geocoding):
- **Google** (Geocoding, Places, Address Validation API) — Zealot's existing client
- **Loqate**, **Smarty**, **Melissa** — validation-first vendors
- **HERE**, **Mapbox**, **Geoapify** — geocoding-first

Product shapes worth copying from, because they ship to every country:
- **Stripe** `address` (billing), **Shopify** `MailingAddress`, **Salesforce** compound address
  field, **HubSpot** address properties

Output of the survey: the recommended field set, the metadata source, the canonical-form approach,
and the first vendor — as a proposal to discuss, not a schema.

## What survives whatever the survey picks

- **Owner is false-polymorphic** (User | Organization | Space) through the registry, like Contact
  and Segment. Roles (billing, shipping, home, business) and a primary per role.
- **Validation and geocoding are an adapter** (INFRA-009): interface, provider, console/mock,
  chosen at `init`. Zealot's `integrations/googleGeocode/api.ts` (embedded VCR) is the first
  provider's client, and `createShippingAddress`'s fallbacks port with it — `postal_town` for a
  missing locality (UK, ZLT-2463), `administrative_area_level_3` with " City" stripped, non-Latin
  components skipped for a Latin one, province and street recovered from the raw string. A
  provider failure saves the address unverified; it never fails the write.
- **Verification state lives on the row** and is cleared by any edit to an address field.
- **Rules read scalar columns**, never the structured value: at least `country`, probably `region`,
  exposed through the customer lens. Finer than that (postal prefix, radius) is a derived
  enrichment (FEAT-020).
- **Consumers snapshot, never reference.** A redemption, invoice or shipment keeps its own copy of
  the address as used; the owner's row moves on without it. Zealot's `DirectRewardRedemption`
  already does this in flat columns.
- **History is the audit log**, not a table.

## Geo (Aron, 2026-10-05: "we need geo also for sure — PostGIS")

- **PostGIS is the store.** The template has no Postgres extension yet (no `CREATE EXTENSION`, no
  `Unsupported` column), so this is the first: `previewFeatures += ["postgresqlExtensions"]`,
  `extensions = [postgis]` on the datasource, and on `Address` a
  `location Unsupported("geography(Point, 4326)")?` column with a GiST index written in the
  migration SQL. `geography`, not `geometry`: distances come back in metres without a projection
  choice, and every use here is "within N km of", not cartography.
- **The geocoding adapter writes it.** `validate` returns the point with the verdict; the service
  stores it beside the structured fields and clears it with the verification state on any edit.
  Nothing user-entered reaches `location`.
- **Reads are raw SQL on a seam, not Prisma.** Prisma cannot read or filter an `Unsupported`
  column, so `db.raw` queries (`ST_DWithin`, `ST_Distance`, nearest-N by `<->`) live in one
  `packages/db/src/geo/` module. The lens exposes `distanceKm`-style facts only through that seam.
- **Radius rules are an engine question, left open.** json-rules has no geo operator. "Customers
  within 50 km of a Space" would be a `within` distance operator compiling to `ST_DWithin` on the
  SQL rail, haversine in `check()`, and *unsupported* on the Prisma rail — three rails must agree
  before it ships, so it is a json-rules proposal, not something this ticket adds by hand.
- **Timezone falls out of geo.** An owner's primary address point resolves to an IANA zone (Google
  Time Zone API through the same adapter), which is what the app's calendar-period date policy
  needs per owner (see INFRA-036). Worth a line in the survey table: which vendors return it.
- **Cardi.** Aron recalls Cardi had geocoding and that the original idea was to backport it. Zealot
  does have a geocoding client (`integrations/googleGeocode/api.ts`, embedded VCR) and the
  component normaliser (`createShippingAddress`), but no stored geo and no PostGIS. Cardi is not
  checked out locally and not in the inixiative or userevidence GitHub orgs — find it before the
  survey so whatever it solved is a row in the table.

## Frontend (Aron, 2026-10-05: "we really need a good frontend to capture all this stuff")

The capture UI is part of the feature, not a follow-up. Today `packages/ui` has no contact editor
at all (one stream hook), so the address editor is the first owner-scoped editor in the template and
sets the pattern.

- **One `AddressBook` editor per owner** (User, Organization, Space), in `packages/ui`, fed by the
  SDK: the owner's addresses grouped by role — primary, shipping, billing, business, home — with
  "make primary" per role, add, edit, archive. Which roles an owner type shows is config, not
  code: a User has home and shipping, an Organization has billing and business, a Space inherits
  its Organization's billing unless it sets its own.
- **One `AddressForm`**, driven by the per-country metadata the survey picks: country first, then
  the fields that country has, in that country's order, with that country's labels (ZIP vs
  Postcode, State vs Prefecture) and its postal pattern inline. No per-country components.
- **Autocomplete through the adapter's `suggest`**, debounced, country-biased; picking a suggestion
  fills the structured fields and runs `validate`. A `corrected` verdict shows the provider's
  version beside what was typed and asks — never silently overwrites. `unconfirmed` saves with a
  visible "unverified" state and a retry.
- **Freeform paste** — a textarea that goes through `parse`, for the address a user copies from an
  email. The structured form is the result, editable.
- **Map confirmation**: when `location` is set, a small map pin the user can drag to correct the
  point (drag writes `location` only, never the text fields, and marks the point user-corrected).
- **Picker, not just editor**: a `AddressSelect` for consumers (checkout, fulfilment) that lists the
  owner's addresses of a role and returns the **snapshot value**, since consumers store a copy.
- **Rules builder**: `country` and `region` appear as ordinary lens fields in the segment builder
  with the countries table as their option source. The distance operator (below) gets its own
  control — a reference point (an address or a Space) plus a radius with units — once the engine
  has it.

## Query helpers (Aron: "it usually needs raw SQL so probably need helpers")

PostGIS reads cannot go through Prisma, so the raw SQL is written once, typed, in
`packages/db/src/geo/`, and nothing outside that module spells `ST_*`:

- `withinRadius(point, km, { model, fk? })` → ids of Address rows (optionally joined to one owner
  model) within the radius — `ST_DWithin` on `geography`, index-backed.
- `distanceKm(fromAddressId | point, toAddressIds[])` → one query, a `Map<id, km>`; the only way a
  read gets a distance onto a row.
- `nearest(point, n, { model })` → `ORDER BY location <-> $1 LIMIT n`, KNN on the GiST index.
- `pointFromLatLng(lat, lng)` / `latLngFromPoint(row)` → the one place the EWKB/`ST_MakePoint`
  conversion lives; the API never sees PostGIS types, only `{ lat, lng }`.
- All of them take the ambient `db` (txn-aware), apply the soft-delete scope by hand because raw
  SQL is outside the scoper, and are the seam the lens's `distance` fact and the future json-rules
  `within` operator compile against — the SQL rail of that operator *is* `withinRadius`.

## Zealot lessons

- Free-text `address VARCHAR(100)` + `zipCode VARCHAR(100)` on `FanUsers`, re-geocoded at every
  shipment. Parse once at save, store structured, verify, snapshot at use.
- `IntegrationMap`'s "`02109` is a postal code, not the number 2109": postal codes are strings end
  to end.
- Carrier rejections for a missing city and non-Latin locality names made the geocode fallbacks
  load-bearing; they are part of the normaliser, not polish.
- `createShippingAddress` swallowing every error into `null` hid incomplete addresses until the
  carrier bounced them.

## Not in scope

Tax and shipping-rate calculation (FIN-001 and a fulfilment ticket consume the roles). A second
vendor before a consumer asks. Localized display beyond what the provider returns (FEAT-006).

## Related

- **Blocks**: FIN-001 (billing address), physical fulfilment.
- **Rides on**: false-polymorphism registry, INFRA-009, `reference/countries.ts`, PostGIS (first extension; `postgresqlExtensions`).
- **Feeds**: FEAT-021 (country/region in the lens), FEAT-020 (anything finer).
