# BRAND-002: Email Template Governance — Business Plan

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: High
**Created**: 2026-06-11
**Updated**: 2026-06-12
**Dependencies**: Files (INFRA-011 → FEAT-009), Email completion (COMM-001), Billing (FIN-001, net-new), Feature flags (FEAT-003 — the billing→surface-area entitlement layer), Email-builder frontend (net-new, built on INFRA-002 Rules Builder primitives), Theme build-out (net-new)

---

## Executive Summary

Launch a standalone SaaS on top of the template: **multi-tenant email template management with a lens-gated builder, a render/send API, and full governance** (approval workflow, audit trail, version history with rollback).

The one-line pitch: *"Let your customers edit the emails your product sends — without letting them break them."*

The buyer is a B2B SaaS company that sends email on behalf of its customers (vertical SaaS, marketplaces, platforms). Today that buyer either embeds an editor widget (Beefree SDK at $350–$5,000/mo, Unlayer at $250–$2,000/mo) and hand-rolls everything around it — per-tenant overrides, variable safety, locale fallback, approvals, audit — or builds nothing and fields endless "can you change our email?" support tickets. We sell the whole layer, and the hard parts are already built in this repo.

**Why this product, why now (the stopgap rationale):**

- The enabling work — files (FEAT-009/INFRA-011) and email completion (COMM-001) — is already next on the roadmap. The product-specific delta is small.
- Every net-new piece (billing, rate limiting, builder UI patterns, embed/token flow) flows back into the template as reusable infrastructure. Building the product *is* building the template.
- It dogfoods the template end-to-end and produces a public case study for it.
- Revenue while the template matures, without committing to a second long-lived codebase — this *is* the codebase.

---

## 1. The Existing Space

Three adjacent categories exist. None of them sells what we'd sell.

### 1.1 Embedded editor SDKs (closest competitors)

These sell a drag-and-drop editor widget you embed in your SaaS. The customer still builds template storage, tenant overrides, variable safety, approvals, and audit themselves.

| Vendor | Pricing (2026) | What they sell | What they lack |
|--------|---------------|----------------|----------------|
| [Beefree SDK](https://developers.beefree.io/) | $350–$5,000/mo + usage fees (hosted rows, content API, $2/HTML import) | Polished freeform editor, AI assist, "locked rows" | No tenant hierarchy, no field-level guardrails, no approvals/audit, no render/send API |
| [Unlayer](https://unlayer.com/blog/best-email-builder-tools) | $250–$2,000/mo + Enterprise | 4-in-1 editor (email, landing pages, popups, docs) | Same gaps; broader but shallower |
| Stripo, Topol, [Chamaileon](https://chamaileon.io/compare-email-builder-alternatives/embedded-email-builders/) | Lower-priced tiers | Editor plugins | Same gaps |

**Key read:** the market has validated $250–$2,000/mo for *just the editor third* of this product. Their "permissions" story is coarse (lock a row, hide a tab). None of them know what a tenant is.

### 1.2 Notification infrastructure (adjacent, partial overlap)

Knock, Courier, Novu (open source). They sell the *pipeline* — multi-channel orchestration, preferences, batching — with template management as a supporting feature. Their template editors are basic, their tenant-override stories are thin, and they want to own sending. We are not competing on orchestration; we interoperate (our render output feeds whatever sends).

### 1.3 ESPs with templates (not competitors, integration targets)

Resend, Postmark, Loops, Customer.io, SES. Sending + light template features for the sender's *own* emails. No embeddable builder, no multi-tenant overrides. **These are our BYO sending backends, not rivals** — "works with your Resend/SES/Postmark account" is a feature and a distribution channel.

### 1.4 The gap

Nobody sells the **multi-tenant template hierarchy + governance layer**: per-tenant branded overrides with platform-controlled guardrails, approval-gated publishing, attributable history, and a render/send API — as one product. Every B2B SaaS that lets customers customize emails hand-rolls this badly, exactly the way every SaaS hand-rolls event buses badly (see CLAUDE.md §6 — same migration we skip, different domain).

**Positioning: "email template governance for multi-tenant SaaS," not "email builder."** We don't win an editor-polish war against Beefree. We win because the builder is the interface and governance is the product. The compliance-adjacent segment (fintech, insurance, health SaaS) *must* answer "who changed the email our customers received, and who approved it" — incumbents have no answer, and that segment pays $1–2k/mo without blinking.

---

## 2. What Already Exists in This Repo

Mapping built primitives → product features:

| Primitive (built) | Product feature |
|---|---|
| Org → space tenancy, memberships, context routing | The tenancy model maps 1:1: **an org is a tenant** (the paying platform — our customer), **its spaces are subtenants** (that platform's customers). Every cascade, lens scope, permission grant, and bill in this plan hangs off that two-level mapping |
| EmailTemplate with default/admin/org/space polymorphic ownership + locale fallback | The override cascade — the core product mechanic |
| EmailComponent (`{{component:slug}}` composition, per-slug cascade resolution) | Structured block system the builder edits — and the copy-on-write inheritance mechanic (§3.3): subtenants override individual blocks, inherit the rest live |
| Lens system (`packages/db/src/lens`) | Field/block-level edit guardrails per tenant role (§3) |
| RBAC/ABAC/ReBAC + permix + row-level `permissionRules` | Who can view/edit/publish/approve which templates |
| Inquiry state machine (draft→sent→approved/denied) | Approval-before-publish workflow |
| AuditLog with full `before`/`after` JSON, EmailTemplate/EmailComponent as indexed subjects, `sourceInquiryId` lineage | **Version history is already built.** Every template state ever, attributed to an actor, linked to its approval. EmailTemplate is not in the redaction registry, so snapshots are complete. Restore = write a prior `after` back as a normal update (which is itself audited — restores are undoable, history never rewrites) |
| Hierarchical tokens (user/org/space-scoped, SHA-256, Redis-cached) | Embed auth + API keys |
| OpenAPI 3.1 → generated typed SDK + TanStack Query hooks | Customer integration SDK — a selling point, generated for free |
| Webhooks (HMAC, delivery tracking, retries) | "Template published" / "render failed" events to customer systems |
| BullMQ queues, app events, websockets | Async render/send, live preview collaboration later |
| Multilayered communication preferences: `CommunicationKind` policy + `Contact.acceptedKinds` + `CustomerRef.acceptedKinds` + `canDeliver` dual gate | Unsubscribe/preference enforcement (§4.1) — both the address layer and the per-platform relationship layer must accept a kind for delivery; `system` bypasses. Schema and check exist; the unsubscribe flow and send-job wiring remain |
| Field encryption (AES-256-GCM) | Customer's ESP API keys at rest |
| Superadmin app + spoofing | Our own support tooling, day one |

---

## 3. How Lenses and Permissions Would Work

### 3.1 Lens layer — *what surface a viewer can even see*

Today's mechanics (all in `packages/db/src/lens` + `@inixiative/json-rules`):

- `lensFor(model)` creates a `Lens` over the generated `prismaMap` for any model.
- `LensNarrowing` composes via `parent` chains: `picks` (whitelist fields), `omits`, `enumOmits` (hide enum values), `where` (server-enforced row scope).
- Routes declare a static `filterLens`; `scopeNarrowing` middleware merges per-request, ctx-aware `where` conditions; `redactLens` layers the redaction registry on top. The server, not the client, owns the narrowing.

Product application — three narrowings, all composed from the same primitive:

1. **Catalog narrowing (row scope).** Which template slugs a tenant sees at all. `where` keyed off the requesting token's org/space — a space-scoped token literally cannot list, render, or reference templates outside its cascade. This is the existing `scopeNarrowing` pattern applied to EmailTemplate routes; near-zero new code.

2. **Edit-surface narrowing (field/block scope).** The platform owner (our customer) defines, per tenant level and role, which parts of a template are editable: `picks` over template fields (e.g. space members may touch `subject` and designated content slots, never the MJML skeleton or system variables), `enumOmits` over block/component types (tenant can insert `hero` and `text` blocks, not `raw-html`), and component-prop narrowing for which props of each EmailComponent are exposed (logo URL yes, padding no). The builder UI asks the server "what is my editable surface for this template?", receives the composed narrowing as JSON, and renders *only those controls*. Server enforces the same narrowing on write — the UI is a convenience, the lens is the boundary.

3. **Variable narrowing (render safety).** Render/send API calls validate supplied variables against the lens for the calling token. A tenant cannot override `{{reset_link}}` or any platform-reserved variable; attempting it is a structured `makeError` response, not a silent merge. This is the line item that makes "let customers edit transactional email" safe at all, and no incumbent has it.
   Note the guarantee hierarchy: the lens is the *configurable* guardrail layer (tenants define narrowings for their subtenants). Unsubscribe sits a level above that — it is injected automatically by the send pipeline for non-system kinds, is not part of any editable surface, and cannot be removed by any narrowing configuration at any level. Restyling (via theme tokens) is the only customization. Compliance is enforced by code, not by configuration that someone could get wrong.

The differentiator vs. Beefree/Unlayer "locked rows": their locking is a flag in a client-side JSON design document. Ours is server-enforced, role-aware, composable narrowing that also scopes *rows* and *enum values* — and it already exists.

### 3.2 Permission layer — *what a viewer can do with that surface*

- **Role mapping.** Tenant (org) admins = our customer's platform staff; subtenant (space) members = their customers' users with space roles. Existing hierarchical inheritance (org owner ⇒ space access) gives the tenant's staff implicit reach into every subtenant's templates — exactly the support model this product needs — while subtenants stay walled off from each other by token scope.
- **Actions.** `template:view / edit / publish / approve / manage-guardrails` as permix checks. `manage-guardrails` (editing the lens narrowings themselves) is org-admin-only — tenants never edit their own cage.
- **Row-level sharing.** Existing `permissionRules` overrides cover "share this one template with an outside contractor" without widening role grants.
- **Approval flow.** Publish raises an Inquiry (source: editing space user, target: org admin). On approve, the publish mutation runs with `sourceInquiryId` stamped into the audit row — version → approval lineage for free. Platforms that don't want approvals just grant `publish` directly; the workflow is opt-in per org.
- **Embed auth.** The embedded builder boots with a space-scoped token minted by the customer's backend. Token scope *is* the tenant boundary; the lens composes from it. No new auth concepts.
- **Versioning/rollback.** Timeline reads `AuditLog` filtered by `subjectEmailTemplateId` (already indexed). Restore endpoint requires `template:publish` (a restore is a publish) and writes the chosen `after` state back. Constraint to encode now: **audit rows for email subjects are exempt from any future retention policy** (see INFRA-007/INFRA-009 — cold storage is fine, deletion is not), or "version history" silently becomes "recent history."

### 3.3 Inheritance is copy-on-write per component — already built

The customization model is **not** "fork the template." `lookupCascade` (`packages/email/src/render/lookupCascade.ts`) resolves each component slug *independently* through space → org → default, and `expand` recursively expands refs through that cascade. So when a subtenant customizes a template:

- "Use my parent's template, change the logo" = materialize **one** space-level `EmailComponent` with slug `logo`. Every other block keeps resolving live from the parent at render time. Nothing is copied.
- **No fork rot.** When the tenant fixes its footer or rebrands a shared component, every subtenant gets it instantly — except where they've deliberately overridden. The classic failure mode ("200 customer copies of a template, now patch the unsubscribe link in all of them") cannot happen.
- **The builder's "edit this block" action *is* copy-on-write.** Editing an inherited block creates the subtenant-level override record; "revert to inherited" deletes it and inheritance resumes. The builder UI should badge every block as *inherited from {level}* / *overridden here*.
- **Customization is queryable.** A subtenant's entire delta is exactly its set of space-level records — "show me what this subtenant changed" is a one-line query, and audit history per override is already attributed.
- **Lens and inheritance compose.** "Which blocks may this subtenant override" is the same narrowing as "which blocks are editable" (§3.1.2) — the overridable surface is the lens surface. A subtenant can never override a block the tenant locked, because the override record can't be written through the narrowing.

Competitive contrast worth marketing copy: incumbents' "saved rows" and template duplication are **copies that drift**. Ours are **live-inherited deltas**. That single design difference is why governance at scale works here and doesn't there.

---

## 4. What We Need to Build to Launch

**Hard launch dependencies — the product cannot ship without all four:**

1. **Files** (INFRA-011 → FEAT-009) — template image assets need multi-tenant storage, binding, and serving
2. **Email completion** (COMM-001) — render pipeline, BYO provider keys, send tracking
3. **Billing** (net-new) — Stripe subscriptions per tenant org; no billing, no product. Built API-first so an agent can subscribe and pay without a human (§6.3)
4. **Email-builder frontend** (net-new) — the structured editor is the product's interface; API-only is a design-partner phase, not a launch

### 4.1 Prerequisites — already on the roadmap (work we'd do anyway)

| Work | Ticket | Product-specific notes |
|---|---|---|
| S3 adapter + buckets | INFRA-011 | Unblocks files |
| File management | FEAT-009 | **Scope v1 to template assets**: upload, bind (image → template/component via ResourceBinding), serve. Defer folders/sharing UX |
| Email completion | COMM-001 | Render pipeline hardening, BYO provider keys per org (Resend/SES/Postmark adapters, encrypted), send tracking. **Ticket is stale** — rewrite around the implemented MJML EmailTemplate/EmailComponent system, not React Email. The render pipeline itself does not need INFRA-002 (conditional sending is out of v1 scope) — but the builder UI does (next row) |
| Unsubscribe + communication preferences | COMM-001 (open TODO in `docs/claude/COMMUNICATIONS.md`) | **Launch scope, not optional** — promotional sending without working unsubscribe is a CAN-SPAM/GDPR/CASL violation, and a *governance* product cannot ship non-compliant. **The multilayered check is already designed and in the schema:** `CommunicationKind` (system/platform/activity/marketing — system always delivers, platform/activity opt-out, marketing opt-in) gated at **two layers that must both accept** (`canDeliver`, `apps/api/src/lib/messaging/canDeliver.ts`): `Contact.acceptedKinds` (channel/address-level — "stop marketing to this email everywhere") and `CustomerRef.acceptedKinds` (relationship-level — "stop marketing from *this* platform"). Because CustomerRef *is* the (customer, provider) pair, tenant scoping is structural — one platform's opt-outs cannot bleed into another's. Remaining for launch: **automatic unsubscribe injection** — for non-system kinds the pipeline appends the unsubscribe footer at render/send time; it is *not* part of the editable surface at all, so it sits **above lens control**: no narrowing configuration, at any level including the tenant, can remove it. It can only be *restyled* (a styleable footer component consuming `{{theme.*}}` tokens). Lens guardrails are what tenants configure; unsubscribe is a hard pipeline invariant nobody configures. Plus: the signed landing flow that writes the correct preference layer; wiring `canDeliver` into the send job; preference-center UI (overlaps FEAT-012 — share the model); and **reconciling `EmailTemplate.category` (`CommunicationCategory`: system/promotional) with `CommunicationKind`** — migrate the template field to kind so `canDeliver` keys directly off the template being sent |
| Rules Builder | INFRA-002 | Already planned for the next month or two — and it supplies **~80% of the builder's editing primitives**: lens traversal UI, field selection/pickers, enum evaluation, value injection/interpolation. Building a rule and editing a template are the same interaction (walk a lens, pick fields, put in values, evaluate enums); the email builder is that engine plus an email-specific rendering layer. This reframes the builder from "the big lift" to a composition exercise |
| Feature flags / entitlements | FEAT-003 | **The billing→surface-area control layer.** Platform/org/space-scoped flags with rule-based targeting (rides INFRA-002 + `@inixiative/json-rules`), Redis-cached, polymorphic ownership — already specced. Billing (FIN-001) writes the org's entitlements; FEAT-003 translates plan → enabled surface area (tier toggles, limits, governance features on/off); the lens layer enforces what a token can then see/do. Every plan gate in §5 resolves through a flag, not a hardcoded tier check scattered through the product — and per-space flag scope means subtenant-level entitlement (delegated billing, §4.2.7) is the same mechanism |

### 4.2 Net-new — the actual product delta

Ordered by size, largest first:

1. **Structured block builder UI** (de-risked by INFRA-002).
   v1 is a *structured* editor over EmailComponent — tenants compose lens-exposed blocks and edit lens-exposed props — **not** freeform drag-and-drop. This is dramatically less work than a Beefree clone, it's safer (which is the whole pitch), and "guardrailed by design" reframes the missing freeform editor as a feature.
   The editing core (lens traversal, field pickers, enum evaluation, value injection) comes from the Rules Builder — what's genuinely email-specific shrinks to: block composition UX over EmailComponent, live MJML preview (server-rendered via existing MJML packages — don't hand-roll HTML email rendering), locale switcher, lens-filtered variable palette, asset picker (FEAT-009 files), and theme-token integration (item 2).
   Inheritance UX (§3.3): every block badged *inherited from {level}* vs *overridden here*; editing an inherited block materializes the copy-on-write override; one-click "revert to inherited."
2. **Theme build-out** (prerequisite for the builder's brand story).
   `SpaceTheme` exists today as a frontend type (5-role brand palette + logo/logoDark/favicon) with a `useSpaceTheme` hook — but nothing is persisted. Build: persist themes at org *and* space level (tenant default, subtenant override — same cascade as templates), a theme editor (reusing the same field/color primitives), and expose theme tokens to templates as **platform-reserved variables** (`{{theme.primary}}`, `{{theme.logo}}`). This is the "brand kit" feature: default templates auto-brand per subtenant with *zero* editing — a subtenant gets on-brand email the moment its theme is set, before anyone opens the builder. Overlaps FEAT-007 (white-labeling); whatever persists here serves both.
3. **Public API surface.** CRUD/render/preview/send/test-send routes via existing route templates; API keys = existing tokens; OpenAPI → SDK generated. Mostly assembly.
4. **Embed flow.** People want a builder they can plug in — this is the product's front door, not an afterthought. Iframe or web component + the scoped-token handshake; postMessage events (saved, published, approval-requested). Token infra exists; the packaging is new.
5. **Version timeline + restore.** Read endpoint over AuditLog + restore endpoint + timeline UI. Small (§3.2).
6. **Guardrail management UI.** Org-admin screens to define per-role narrowings (which blocks/props/variables each tenant role gets). Start opinionated: 3 preset profiles (locked-down / branding-only / full) + JSON escape hatch; visual narrowing editor later (overlaps FEAT-008 permissions builder — INFRA-002 primitives apply here too).
7. **Billing.** Stripe subscriptions per tenant org, plan gates (subtenant count, renders/sends per month) **enforced via FEAT-003 feature flags** (billing writes the org's entitlements, flags gate the surface area — see §4.1; billing never gates UI directly), usage metering via existing app events. **API-first**: every billing operation exposed as API + MCP tools so agents can purchase (§6.3), dashboard as a consumer. Flows back into the template as the missing billing module (FIN-001).
   **Delegated subtenant billing:** usage is already attributable per space, so meter per subtenant from day one. v1 ships **subtenant invoicing** — the tenant sees per-space line items and can generate pass-through invoices to its customers (their re-billing problem, solved). v2 is **true delegated billing**: a space carries its own payment method and pays directly (likely Stripe Connect — tenant as connected account). This monetizes the tenant's side too: platforms can *charge their customers* for email customization, which makes buying us revenue-positive for them — a sales argument no incumbent can make.
8. **Rate limiting.** Middleware over existing Redis. Required for a public API; flows back into template.
9. **Marketing site + docs.** Landing page, quickstart ("branded tenant emails in 30 minutes"), SDK docs from OpenAPI.

### 4.3 Explicit non-goals for v1

- Freeform drag-and-drop editing (v2, or embed Unlayer beneath the lens layer if demanded)
- Being an ESP — we never own deliverability; BYO sending keys only
- SMS/push/in-app channels (notification-infra turf; later via app-event bridges)
- Permissions-as-a-service as a standalone product (Permit.io/Oso/WorkOS FGA turf — we *use* permissions as a feature, we don't sell them)
- Open/click analytics beyond provider passthrough

### 4.4 Rough sequencing

- **Phase 1 — Foundations** (roadmap work, product-scoped): INFRA-011 → FEAT-009-lite → COMM-001 rewrite, with **INFRA-002 (Rules Builder) proceeding in parallel** as already planned — it lands the lens-traversal/field-selection/enum primitives the builder consumes in Phase 3. Exit: an org can upload an asset, edit a template via API, render and send through its own Resend key.
- **Phase 2 — Governance + theming**: lens narrowings on template routes, permix actions, Inquiry publish flow, version timeline + restore, theme persistence + `{{theme.*}}` tokens. Exit: full edit→approve→publish→rollback loop via API, fully audited; default templates auto-brand per subtenant.
- **Phase 3 — Builder + embed**: structured editor composed from Rules Builder primitives + MJML preview layer, guardrail presets UI, embed handshake. Exit: a space-scoped token can open the embedded builder and safely edit only its surface.
- **Phase 4 — Launch**: billing (incl. per-subtenant metering + invoicing), rate limiting, docs/marketing, 2–3 design-partner integrations. Exit: first paying org.

Realistic horizon: ~2–3 months of focused work. Phase 1 is already-planned roadmap; the Phase 3 schedule risk is substantially reduced by riding INFRA-002 — the builder's editing core arrives with the Rules Builder instead of being built twice.

---

## 5. Business Model

- **Pricing anchor:** incumbents validated $250–$2,000/mo for the editor alone. Price on **tenant count + monthly renders/sends**, not seats:
  - **Dev** — free: 1 org, 3 tenants, test sending only
  - **Starter** — ~$99/mo: 25 tenants, builder + API, community support
  - **Growth** — ~$399/mo: 250 tenants, approvals + audit timeline + embed
  - **Scale** — ~$999+/mo: unlimited tenants, SSO, retention guarantees, SLA
  Governance features (approvals, audit, rollback) gate the Growth/Scale tiers — they're what the compliance segment pays for. Every tier gate is a **FEAT-003 feature flag keyed off the billing plan**: FIN-001 sets the org's entitlements on subscribe/change, flags resolve plan → surface area, the lens layer enforces — so there are no hardcoded plan checks scattered through the product, and a tier's surface can be re-cut without a deploy.
  Additionally, a **metered agent tier** (fast-follow, §6.3): pay-per-render/per-send via x402-style machine payments, no subscription — priced per call, purchasable by an agent with no human in the loop.
- **Delegated subtenant billing as a revenue argument:** per-space metering ships day one, subtenant invoicing in v1, direct subtenant payment (Stripe Connect) in v2. The tenant can re-bill or directly charge its customers for email customization — buying us becomes revenue-positive for the platform, not a cost line. Gate invoicing at Growth and delegated payment at Scale.
- **Wedge ICP:** B2B vertical SaaS (10–200 employees) in compliance-adjacent verticals — fintech infra, insurance, health, HR — whose customers demand branded transactional email.
- **GTM channels:** integration-first content ("multi-tenant email templates with Resend/SES/Postmark"), the template itself as a public case study, OpenAPI/SDK-driven DX as the demo, template-gallery SEO, 2–3 design partners from network before launch.

---

## 6. Agent-Friendly by Design

A growing share of buyer integration work — and, increasingly, day-to-day template editing — is done by AI agents, not humans. Beefree/Unlayer are agent-opaque: an iframe drag-and-drop canvas that no agent can drive. Our architecture is agent-legible by accident; making it agent-friendly on purpose is cheap and is a genuine differentiator worth a pricing-page line.

### 6.1 Why our architecture is already agent-shaped

- **Structured blocks, not freeform HTML.** The v1 editor's data model is a JSON composition of typed EmailComponent blocks with schema'd props. Agents edit JSON-against-schema reliably; they mangle freeform MJML/HTML. The same decision that makes the builder safe for tenant humans makes it tractable for tenant agents.
- **Lens = agent guardrails.** An agent authenticates with the same scoped token a human session would, and gets the same server-enforced narrowing — it physically cannot see other tenants' templates, touch locked blocks, or override reserved variables. We don't need a separate "AI safety" layer; the guardrail story *is* the agent story. ("Give your customers' AI agents edit access without giving them a way to break production email.")
- **OpenAPI 3.1 + generated typed SDK + structured `makeError` responses with guidance text.** Agents self-serve the spec, get compile-checked calls via the SDK, and receive actionable errors instead of opaque 400s.
- **Human-in-the-loop is already built.** The Inquiry publish flow is the natural checkpoint: agents draft and propose, humans approve. Audit rows attribute agent actions via `actorTokenId`, so "which agent changed what, and who approved it" is answerable from day one — governance positioning extends to agent actors for free.

### 6.2 What to build for it

| Item | Effort | Notes |
|---|---|---|
| **MCP server** exposing template ops (list/get/edit-blocks/preview/render-test/propose-publish) | Small–medium | Thin wrapper over the public API; auth via existing scoped tokens so lens/permissions apply unchanged. FEAT-014 already plans MCP infrastructure for the template — this is its first product-grade consumer |
| **Agent discovery**: `llms.txt`, `/.well-known/api-docs`, `<link rel="api">` metadata | Small | DOC-002 verbatim — promote it from "optional" to launch scope for this product |
| **Idempotency keys** on mutating API routes | Medium | Agents retry; double-publish and double-send must be impossible. API-001 already specs this — becomes a launch dependency of the API surface |
| **Agent-mode docs**: quickstart written as a prompt ("point your coding agent at this page"), copy-paste MCP config | Small | Cheap, high-signal for the dev-tools audience |
| **Per-token agent labeling** (e.g. a `kind: agent` flag on tokens) | Small | Lets customers filter audit timelines and approval queues by human vs. agent actors; additive field, no signature churn |

### 6.3 Agents as buyers — agent-payable billing

Agents shouldn't just integrate the product; they should be able to **buy** it. The payment rails matured in the last year and this is now a launch-realistic differentiator rather than speculation:

- [Stripe's Agentic Commerce Protocol](https://docs.stripe.com/agentic-commerce/acp) (co-developed with OpenAI) is live with scoped tokens, buyer auth, and native MCP transport; Stripe's [Agentic Commerce Suite](https://stripe.com/blog/agentic-commerce-suite) makes a business sellable *to* agents with one integration.
- [Stripe Machine Payments shipped x402 support](https://thepaypers.com/payments/expert-views/x402-standardising-the-protocol-for-agent-to-agent-commerce) (USDC on Base) in Feb 2026; x402 is doing real volume ([165M transactions, ~$0.30 average — built for per-call micropayments](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/)).
- [Google's AP2](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/) was donated to FIDO with v0.2 "human not present" mandates for pre-authorized autonomous purchases.

What it means for us, in two phases:

| Phase | Capability | Notes |
|---|---|---|
| **Launch** | Agent-driven self-serve: an agent can sign up, provision a tenant org, subscribe to a plan, and mint scoped tokens — entirely through the API/MCP server, paying via Stripe with ACP-compatible checkout | Mostly falls out of building billing API-first instead of dashboard-first. The billing module (net-new, flows back into the template / FIN-001) should expose every billing operation as API + MCP tools, with the dashboard as a consumer |
| **Fast-follow** | Metered machine payments: pay-per-render/per-send via x402 (Stripe Machine Payments) with no subscription at all — an agent hits the render API, gets HTTP 402, pays, proceeds | This is the natural pricing unit for agent traffic and a true "no human in the signup loop" tier. Web3 settlement details belong to FIN-002 |

Guardrail consistency: a paying agent gets a tenant org and scoped tokens like any customer — lens narrowing, Inquiry approvals, and audit attribution apply identically. Agent-payable does not mean governance-exempt; it means the governance product is purchasable without a human filling out a form.

### 6.4 What not to do

No bundled "AI template generator" in v1 (everyone has one, it's table stakes via the customer's own agent + our MCP server anyway), and no agent autonomy past the Inquiry gate — auto-approve stays a customer-side policy decision, not our default.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Editor UX bar — buyers compare against Beefree polish | Don't compete there: structured editor, governance positioning; freeform later or embedded underneath |
| Builder UI eats the schedule (frontend pages are the template's weakest area today) | Phase 3 is deliberately last; Phases 1–2 ship an API-first product usable by design partners without the builder. ~80% of the editing core (lens traversal, field pickers, enum handling, value injection) arrives with INFRA-002, which is happening anyway; the email-specific remainder rides existing MJML packages |
| **Abuse vector: tenant miscategorizes marketing as `system`** to bypass unsubscribe injection and the `canDeliver` gates | Layered defense, ToS last: (1) **default-deny** — new templates default to `marketing`; `system` is never the default. (2) **Permission-gated** — assigning `kind=system` requires tenant org-admin rights at minimum; subtenants can never set it. (3) **Audited + flagged** — kind is an audited field; *recategorizing* an existing template marketing→system is a high-signal event worth an automatic review flag (the audit hook makes this nearly free). (4) **Behavioral detection** — system email is 1:1 and event-driven; bulk fan-out on a `system` template is a red flag the send job can rate-alarm on. (5) **BYO-key alignment** — sending runs on the tenant's own ESP account, so their sender reputation and their ESP's AUP are also at stake, not just ours. (6) **ToS/AUP** as the contractual backstop defining miscategorization as a violation with suspension rights — necessary because layers 1–5 constrain and detect but cannot adjudicate intent |
| Deliverability blame lands on us | BYO sending keys only; we render, they send |
| Crowded adjacent markets blur positioning | Lead every page with governance/audit, not "builder" |
| Solo bandwidth / template roadmap stalls | Every phase-1/2 artifact is roadmap work anyway; worst case the product is shelved and the template kept everything |
| Audit-as-version-history undermined later | Encode the email-subject retention exemption now (ties into INFRA-007, INFRA-009-cold-storage) |

---

## 8. Open Questions

- Product name / domain (working title: *Lensmail*? decide before marketing work)
- Delegated billing v2: Stripe Connect (tenant as connected account, space pays directly) vs. invoice-only pass-through — Connect adds onboarding friction but makes us the money rail; decide after design-partner feedback
- Theme persistence shape: JSON column on Organization/Space vs. a Theme model with its own audit/version history (themes are customer-facing brand assets — versioning may matter here too)
- Hosted-only at launch, or self-host tier later (Novu-style open-core is a real option given the repo *is* the product)?
- Does the embed ship as iframe (safest) or web component (nicer DX) first?
- Design partners: which 2–3 contacts get free Scale tier for feedback?
- Legal/entity/ToS — out of repo scope, needs a parallel track before charging. ToS must include the AUP clause covering `system`-kind miscategorization (see Risks) — industry-standard for ESPs, and our preference gates make it load-bearing here

---

## Related Tickets

- **Prerequisites:** INFRA-011 (Railway buckets), FEAT-009 (file management — scoped v1), COMM-001 (email system — needs rewrite; render pipeline doesn't need INFRA-002; includes unsubscribe + preference management as launch scope), INFRA-002 (rules builder — supplies the builder's editing primitives), FEAT-003 (feature flags — the billing→surface-area entitlement layer; gates every tier in §5; blocked by INFRA-002 + INFRA-004)
- **Unsubscribe/preferences:** COMM-002 (email validation), FEAT-012 (notifications — preference-center model should be shared)
- **Consumed by this plan:** FEAT-001 (inquiry, done), FEAT-017 (audit explorer — version timeline overlaps), FEAT-008 (permissions builder — guardrail UI is its first consumer), FEAT-007 (white-labeling — theme persistence serves both), INFRA-007 / INFRA-009-cold-storage (retention exemption)
- **Agent-friendliness (§6):** FEAT-014 (AI developer experience — MCP infrastructure), DOC-002 (AI-discoverable API metadata — promote to launch scope), API-001 (idempotency — launch dependency of the public API)
- **Agent payments (§6.3):** FIN-001 (financial fiat — billing module, ACP-compatible checkout), FIN-002 (financial web3 — x402/USDC machine-payment settlement)
- **Unblocked-for-template by this plan:** billing module, rate limiting, embed/token packaging

---

## Comments

_2026-06-11 — Created from product exploration session: market scan of embedded editor SDKs (Beefree $350–$5k/mo, Unlayer $250–$2k/mo), confirmation that AuditLog `before`/`after` + EmailTemplate subject FK already constitutes version history, and lens/permission design sketch._

_2026-06-11 — Revision: made the four hard launch dependencies explicit (files, email completion, billing, builder frontend) and added §6 Agent-Friendly by Design (MCP server, llms.txt/.well-known discovery, idempotency, agent actor labeling; ties to FEAT-014, DOC-002, API-001)._

_2026-06-11 — Revision: pinned the tenancy vocabulary (org = tenant, space = subtenant) throughout, and added §6.3 Agents as buyers — API-first billing purchasable by agents at launch (Stripe ACP), metered x402 machine payments as fast-follow; ties to FIN-001/FIN-002._

_2026-06-11 — Revision: INFRA-002 Rules Builder added as a builder prerequisite (~80% of the editing primitives: lens traversal, field pickers, enum evaluation, value injection — building a rule and editing a template are the same interaction); theme build-out added as a net-new workstream (SpaceTheme type + useSpaceTheme exist frontend-only, nothing persisted; persist at org+space, expose `{{theme.*}}` reserved variables, overlaps FEAT-007); delegated subtenant billing added (per-space metering day one, invoicing v1, Stripe Connect direct payment v2)._

_2026-06-11 — Revision: added §3.3 — verified that copy-on-write per-component inheritance is already implemented (`lookupCascade` resolves each component slug independently through space → org → default). Subtenant customization = sparse overrides, everything else inherits live; no fork rot; overridable surface = lens surface. Builder inheritance UX (inherited/overridden badges, revert-to-inherited) added to §4.2._

_2026-06-11 — Revision: unsubscribe + contact communication preferences referenced as launch scope (§4.1): `CommunicationCategory` enum exists, preference management is an open COMM-001 TODO; unsubscribe link as a lens-locked reserved variable; per-contact, per-tenant preferences on the Contact model; per-tenant suppression in the send job. Refs COMM-002, FEAT-012._

_2026-06-11 — Correction: the multilayered preference check is already designed in the schema — `CommunicationKind` policy with `Contact.acceptedKinds` AND `CustomerRef.acceptedKinds` dual-gated via `canDeliver`; CustomerRef being the (customer, provider) pair makes tenant scoping structural (supersedes the earlier suppression-key migration warning). Remaining: unsubscribe link/landing flow, send-job wiring, preference-center UI, and reconciling `EmailTemplate.category` with `CommunicationKind`._

_2026-06-11 — Design decision: unsubscribe is injected automatically by the send pipeline for non-system kinds, sits **above lens control** (not part of any editable surface), cannot be deleted by any narrowing at any level — restyle-only via theme tokens. Compliance enforced by code, not configuration._

_2026-06-11 — Abuse vector added to Risks: tenant miscategorizing marketing as `system` to bypass unsubscribe. Layered defense (default-deny, permission-gated, audited recategorization flag, bulk-fan-out detection, BYO-key reputation alignment) with ToS/AUP as the contractual backstop — necessary because code can constrain and detect but not adjudicate intent._

_2026-06-12 — Added FEAT-003 (feature flags) to the dependency tree as the **billing→surface-area control layer**. The chain: FIN-001 (billing) writes the org's entitlements on subscribe/change → FEAT-003 flags (platform/org/space-scoped, rule-targeted, Redis-cached) translate plan → enabled surface area → the lens layer enforces what a token can see/do. This replaces hardcoded tier checks (every plan gate in §5 resolves through a flag, re-cuttable without a deploy), and per-space flag scope makes subtenant-level entitlement (delegated billing) the same mechanism. Refs FEAT-003, FIN-001._
