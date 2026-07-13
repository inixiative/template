# INFRA-028: Lens prose decorator — presentation metadata (labels, icons) for FE + AI

**Status**: 🆕 Not Started — placeholder / problem framing only, no shape decided.
**Assignee**: Aron
**Priority**: Medium (polish over the builder surface; not blocking — surfaces render off raw field paths today)
**Created**: 2026-07-13
**Updated**: 2026-07-13

The lens is the single source of truth for what a surface can reason over — `exposedSurface(lens)` drives the builder surface (INFRA-017), `sourceQueries`/`SourceValues` decorate the option sets (INFRA-024), `checkRuleAgainstLens` gates writes. But a lens carries only field **paths + kinds** (+ enum members); it has no human-facing presentation metadata. This ticket is the **static presentation axis** — the sibling of INFRA-024's dynamic option-value axis.

Motivating consumer: Zealot's segment builder cut its AI condition-generation prompt over from a hand-authored static schema to `exposedSurface(segmentLens)` (ZLT-1470). That killed the second source of truth, but the static schema had also been carrying curated labels (`Points Balance` for `pointsAmount`) — so today the FE title-cases raw paths and the AI sees raw field names, and there's nowhere to hang a per-field icon. Zealot tracker: **ZLT-3633**.

---

## The pull

Two consumers want the same thing the lens doesn't carry:

- **FE rule builder** — a display label + icon per field/relation, instead of a title-cased path.
- **AI prompt builder** — human labels in the field-path listing so the model reasons over `Points Balance`, not `pointsAmount`.

Both are **presentation only**. Hard constraint: a decorator entry must never widen or narrow what's segmentable — the lens `picks` stay the sole authority for the security/validation surface. A field the lens doesn't expose has no decorator; a decorator can't expose a field.

## Open questions (shape TBD)

1. **Where does it live?** A parallel `prose?: Record<path, { label?; icon?; help? }>` on the narrowing? A separate decorator map resolved alongside `exposedSurface`? Or ride the projection the way `sourceValues` does (INFRA-017 already folds `{ lens, sourceValues }`) → `{ lens, sourceValues, prose }`?
2. **Keying.** By full path (`fanMissions.brandMissionUuid`) vs by `(mapName, model, field)`? Path is surface-specific; `(model, field)` is reusable across surfaces — mirror whatever `SourceValues` settles on (INFRA-024 Q2).
3. **Localization.** Labels are user-facing copy → single string or a locale key (FEAT-006)? Placeholder assumes plain strings for MVP.
4. **Icons.** Icon identifier (name in a shared set) vs asset ref — a presentation-registry concern, probably not the lens's to own.

## Not in scope

Choosing the mechanism; json-rules / rules-builder implementation planning (a `FEAT-*` once a direction is picked). Dynamic per-brand option **values** — that's INFRA-024. This ticket names the static presentation axis and keeps it distinct from both the security surface (`picks`) and the option-value surface (`sources`).

## Related

- **INFRA-017** — Builder Surface (`exposedSurface`); the consumer + likely carrier of the decorator.
- **INFRA-024** — `sourceQueries` richer option sets; the *dynamic* sibling axis (values) where this is the *static* one (labels/icons).
- **FEAT-006** — Localization (labels are user-facing copy).
- **ZLT-3633** — Zealot-side tracker (segment builder lost curated labels/icons on the AI cutover).
- **ZLT-1470** — the cutover that surfaced this (AI prompt now derives from `exposedSurface(segmentLens)`).
