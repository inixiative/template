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

So: an `Address` model with its own owner, lifecycle and shape, **not** a `ContactType.address`
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
- **Rides on**: false-polymorphism registry, INFRA-009, `reference/countries.ts`.
- **Feeds**: FEAT-021 (country/region in the lens), FEAT-020 (anything finer).
