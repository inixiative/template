# COMM-012: Adhoc templates — the projection the system provides, the lens the row holds

**Status**: 🧊 Design captured 2026-09-09 — not scheduled; system emails ship first
**Created**: 2026-09-09

---

## What the stack builds today

The email stack (#74 → #91 → #96 → headless authoring) is the **system-email** build. A send is
triggered by an app event; the event handler names the template; the template's registry entry
(`apps/api/src/lib/email/registry.ts`) fixes the sender and the audience in code. Nobody chooses who
they send as at send time — the entry's `SenderSpec` is bound off the entity row the email is about.
Recipients are always `User` (COMM-010). Identity (from-address, sender variables) is still a stub.

Marketing and outreach sends — an author choosing a sender tier and an audience at send time, with
no event entity — are **not built** and nothing in the stack pretends they are.

## The problem this ticket parks

Two things adhoc needs that system does not:

1. **A demarcation.** Something must say a template is adhoc: no registry entry names its sender and
   audience, so the row must.
2. **A way to compose the template's lens from the data actually available** to the author, so the
   variable picker and condition builder show a real surface and save-time validation has something to
   check against.

## Vocabulary (rulings 2026-09-09)

- **Projection.** What the system provides: the models and fields reachable **from your
  perspective** — a projection of the field map with a synthetic root (`EmailRuleContext` →
  `recipient`, `sender`, `data`). It has no narrowing of its own; it is the space a lens is built
  from. Perspective is the open half (below): today the projection is the whole map; it must become
  what the authoring actor can actually reach.
- **Lens.** A lens has a starting point. Each slot on the row is **its own lens**, built from the
  projection by choosing an **entry point** and then **relations** (and the picks along them):
  - `recipient` — entry point fixed at `User` (COMM-010); the author chooses relations.
  - `sender` — entry point is the sender model (from the registry entry's `SenderSpec` for a system
    template); the author chooses relations.
  - `data` — **unknown by construction**: the per-template payload nobody can declare ahead of the
    event. With no entry point chosen its root is a `Json` field, so every `{{data.…}}` path and
    every rule beneath it stays addressable at any depth and validation reports it as *beneath
    Json* (a warning, never a rejection). The author may **choose an entry point** for it from the
    projection (`lens.data.model`) and then relations (`lens.data.narrowing`); a registry entry's
    entity model is the default entry when the row is silent.
  The row column `EmailTemplate.lens` holds the three: `{ recipient?: ModelNarrowing, sender?:
  ModelNarrowing, data?: { model?, narrowing? } }`, authored on the slug's default-tier row and
  inherited through the cascade.
- **Surface.** `exposedSurface(lens)` — what the builder receives. Never carries a `where`.
- **Floor.** The scope bound from the sender at send time, applied server-side under the row's
  lens. Never stored on the row.

`packages/email/src/rules/emailProjection.ts` implements projection → lens → surface.

## Sockets already in place

- The registry entry is data, not code: entity narrowing + sender spec + recipient narrowing + bindings,
  all serializable. An adhoc send is an entry composed at runtime instead of read from the code map;
  the planner does not care where the entry came from.
- Bindings resolve from an ordered context (data → entity → sender → handoff). An adhoc entry binds
  its recipient scope from the sender instead of the entity.
- The `Sender` union and the owner cascade already cover every tier an adhoc author could send as.
- `CommunicationKind.marketing` exists with its own opt-out and unsubscribe gating.
- The event rail: an adhoc send enters as an event carrying template, sender, and audience, so
  idempotency, the log, and the closure come for free.

## Decisions taken

- **Demarcation is not a flag.** A system template has a registry entry. An adhoc template has none and
  carries its lens on its row. The planner resolves the entry registry-first, then row. Today a slug
  with no entry is silently skipped in `sendEmail` — that skip is the line that becomes the socket.
- The floor is bound from the sender at send time and never stored on the row.
- Multi-lens recipients and the sender × recipient governance matrix stay parked in COMM-011.

## What remains

1. **Perspective.** The projection must narrow to what the authoring actor can reach — the same
   question the API already answers for reads (`scopeNarrowing` stacks the actor's scope under a
   route's `filterLens`; FE-004 derives lenses from the endpoint schema). Decide whether the
   projection is built server-side from the actor's rebac scope, or served as the full map and
   narrowed by the same mechanism the read routes use. Until then the admin route serves the whole
   map (superadmin only).
2. **Sender entry point for an adhoc row.** Recipient and the data bag need no declaration, so an
   adhoc row already has a usable projection. What is undeclared is the sender model (a narrowing
   cannot name it). Options: (a) the row declares it, or (b) the adhoc send request supplies it and
   the row's lens is validated against every sender tier it allows.
3. **Registry `picks` vs the row lens.** `RecipientSpec.picks` and `DEFAULT_RECIPIENT_LENS` say the
   same thing twice. Once system templates have a row lens, the planner should hydrate from it and the
   registry should keep only `where` + `bindings`.
4. **Entry-from-row.** `resolveEntry` for a template with no registry entry: sender from the send
   request, recipient narrowing from the row lens under the sender floor.
5. **Model-keyed surface.** `exposedSurface` keys fields by model, so two slots that reach the same
   model (a `welcome` template whose recipient and entity are both `User`) expose the union of both
   narrowings to each slot. Harmless for system templates; decide whether an adhoc picker needs a
   path-keyed surface before it matters.
6. **Adhoc send event** + the `sendEmail` fallback from "no entry → skip" to "no entry → row".

## Forms — the palette and the shell (Aron, on top of #97)

Headless pieces land in #97: projection/lens/surface, regions, the MJML nesting table, the rule
surface route, `useEmailRuleSurface`, `useEmailVariableScope`. The forms are a port of Zealot's
admin-dashboard components onto those hooks, plus two API surfaces template lacks.

**Palette** — what the editor can insert, and where each list comes from:

- **Components** from the library: the slugs at the author's tier plus what cascades from above.
  Needs EmailComponent list/CRUD routes (Zealot #1653) and EmailTemplate read/save routes
  (hydrate on read, decompose on save, authoring errors → 422).
- **Slots**: a slot with a default when authoring a component; an override when filling a ref.
- **MJML objects**: section, column, text, button, image, … — constrained by `canNestMjml` so the
  palette only offers what fits the cursor's parent.
- **Conditionals, loops, variables** off the surface: the condition builder anchored at the
  surface (`RuleBuilder` from rules-builder), loop portals from `useEmailVariableScope`, tokens
  from its values.

**Panes** — editor surface, preview, data, MJML source. The data pane is where the unknown bag
becomes concrete: the author supplies a sample payload; the preview renders against it; the same
fixture drives the beneath-Json warnings so the author sees which data paths the sample does not
satisfy. Needs a preview route (compose + interpolate against the fixture → HTML + warnings; Zealot
has one).

**Shell** — platform-level authoring lands in `apps/superadmin`, matching the admin routes, in the
rail / editor / inspector layout `docs/email-builder-mockup.html` shows. Regions drive the
inspector: per-component tier badges (inherited / shadowed / forked / dangling), collapse-to-ref,
remove-override, revert-to-default.

**Order**: component + template routes → preview route → palette + insert dialogs → editor surface
+ panes → shell mount.

## Related

COMM-009 (slots), COMM-010 (governance + each-loops: the lens-on-row and builder-surface rulings),
COMM-011 (multi-lens, parked). Zealot's `ruleContext`/`slotLenses` columns and `buildEmailRuleLens`
are the same shape split across two columns; template keeps one `lens` column.
