# INFRA-041 — A write to a source model clears (or rebuilds) the lens source caches that read it

**Status:** 🆕 Not Started · **Line:** INFRA · **Priority:** Medium · **Related:** Zealot ZLT-6030 (#3025), ZLT-5975, INFRA-039

## Context

Lens source option sets (the values a rule builder offers) are cached per tenant for 10 minutes.
Nothing clears them when the rows behind them change. So a segment created now does not appear in
the picker for up to 10 minutes. A save check that must be correct cannot read that cache either:
Zealot's save gate reads the source live for that reason, through a second copy of the reader.

`registerClearCacheHook` (`apps/api/src/hooks/cache/hook.ts`) already clears keys after commit when a
model is written, from `cacheReference` (model → keys). Lens source caches are not in it, because
their key is a hash of the compiled query, which a row cannot name.

## Shape

1. **Key lens source caches so a row can name them:** `(tenant, model, query hash)`, cleared by the
   `(tenant, model)` prefix.
2. **Register source models in `cacheReference`.** A write to a model any lens sources (segments,
   missions, tags, maps, …) clears that tenant's entries for that model. This is the existing hook,
   with no new registry.
3. **Rebuild instead of clear, where asked.** Some caches are expensive to rebuild on the next read
   (the rolling dictionary). A cache declares `onWrite: 'clear' | 'rebuild'`. `rebuild` enqueues the
   existing refresh job (singleton per key) on commit instead of deleting the key, so a reader never
   pays the cold miss.

## Decided (Aron, 2026-10-26)

Zealot ships step 1 and step 2 now, in ZLT-6030 (#3025): a write clears the source caches, and the
save gate reads through the one cached reader. The next read after a write is cold, and that is
accepted. Step 3 (`rebuild`) and per-model keys, if Zealot shipped per-tenant keys, are the
follow-up, and so is building all of it here first.

## Definition of done

- Lens source caches keyed and cleared by `(tenant, model)` through `cacheReference`.
- The `onWrite` declaration, with `rebuild` riding the rolling-cache refresh job.
- A test: create a sourced row; the next `resolveSourceValues` offers it.
- Zealot port ticket linked here.
