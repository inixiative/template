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

## Vocabulary (ruling 2026-09-09)

- **Projection.** What the system provides: the models and fields reachable for this template — a
  projection of the field map with a synthetic root (`EmailRuleContext` → `recipient`, `sender`,
  `data`). It has no narrowing of its own. `recipient` and `sender` are real models. **`data` is
  unknown by construction** — the per-template payload nobody can declare ahead of the event — so
  its root is a `Json` field: every `{{data.…}}` path and every rule beneath it is addressable at
  any depth, and save-time validation reports it as *beneath Json* (a warning, never a rejection).
  A registry entry may refine `data` into a declared shape (the entity model, or the declared
  `data` keys) when one is known; that is an overlay on the unknown bag, not a replacement for it.
- **Lens.** What the row holds: `EmailTemplate.lens`, per-slot narrowings over the projection
  (`{ recipient?, sender?, data? }`, each a `ModelNarrowing`). Authored on the slug's default-tier row
  and inherited by every tenant row through the cascade. Null = engine defaults (recipient = the
  delivery leaf `id, name, email`; sender and data = their scalars).
- **Surface.** `exposedSurface(lens)` — what the builder receives. Never carries a `where`.
- **Floor.** The scope bound from the sender at send time (an organization sender reaches its own
  users and nobody else), applied server-side under the row's lens. Never stored on the row.

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

1. **Where an adhoc template's projection comes from.** Recipient and the unknown data bag need no
   declaration, so an adhoc row already has a usable projection. What is undeclared is the sender
   model (a narrowing cannot name it). Options: (a) the row declares it, or (b) the adhoc send request
   supplies it and the row's lens is validated against every sender tier it allows.
2. **Registry `picks` vs the row lens.** `RecipientSpec.picks` and `DEFAULT_RECIPIENT_LENS` say the
   same thing twice. Once system templates have a row lens, the planner should hydrate from it and the
   registry should keep only `where` + `bindings`.
3. **Entry-from-row.** `resolveEntry` for a template with no registry entry: sender from the send
   request, recipient narrowing from the row lens under the sender floor.
4. **Model-keyed surface.** `exposedSurface` keys fields by model, so two slots that reach the same
   model (a `welcome` template whose recipient and entity are both `User`) expose the union of both
   narrowings to each slot. Harmless for system templates; decide whether an adhoc picker needs a
   path-keyed surface before it matters.
5. **Adhoc send event** + the `sendEmail` fallback from "no entry → skip" to "no entry → row".

## Related

COMM-009 (slots), COMM-010 (governance + each-loops: the lens-on-row and builder-surface rulings),
COMM-011 (multi-lens, parked). Zealot's `ruleContext`/`slotLenses` columns and `buildEmailRuleLens`
are the same shape split across two columns; template keeps one `lens` column.
