# INFRA-044 — A write to a source model clears (or rebuilds) the lens source caches that read it

**Status:** 🆕 Not Started · **Line:** INFRA · **Priority:** Medium · **Related:** Zealot ZLT-6030 (#3025), ZLT-5975, INFRA-042

## Context

**Template today:** lens source option sets are not cached server-side. `sourceQueryValues`
(`packages/db/src/utils/sourceQueryValues.ts`) queries the database on every call, the rolling-cache
registry (`apps/api/src/lib/rollingCaches.ts`) is empty, and `cacheReference` has no lens-source keys.
The only cache is client-side (`staleTime: Infinity` in `useEmailRuleSurface`). So this ticket is the
design for when the template adds a server cache, built here first, then mirrored by Zealot.

**Zealot today:** option sets are cached per brand for 10 minutes (`readLensSource`). Zealot #3025
(ZLT-6030) clears them on write: writes to the tables rules name by uuid clear
`cacheKey('lensSourceValues', { brandUuid, field: 'uuid' }, [], true)` through the existing
`registerClearCacheHook` + `cacheReference`, and the save gate reads through the cached reader.
Zealot follow-up: ZLT-6047.

## Shape

0. **Template first step:** cache option sets server-side through the rolling-cache registry, then the
   steps below.
1. **Key lens source caches so a row can name them:** `(tenant, model, query hash)`, cleared by the
   `(tenant, model)` prefix.
2. **Register source models in `cacheReference`.** A write to a model any lens sources (segments,
   missions, tags, maps, …) clears that tenant's entries for that model. This is the existing hook,
   with no new registry.
3. **Cancel in-flight rebuilds on pattern clears.** Exact-key clears already cancel through the
   generation key; pattern clears do not, so a rebuild started before the commit can write the old
   list back.
4. **Rebuild instead of clear, where asked.** Some caches are expensive to rebuild on the next read
   (the rolling dictionary). A cache declares `onWrite: 'clear' | 'rebuild'`. `rebuild` enqueues the
   existing refresh job (singleton per key) on commit instead of deleting the key, so a reader never
   pays the cold miss.

## Decided (Aron, 2026-10-26)

Zealot ships clearing now, in ZLT-6030 (#3025), as above. The next read after a write is cold, and that is
accepted. Step 3 (`rebuild`) and per-model keys, if Zealot shipped per-tenant keys, are the
follow-up, and so is building all of it here first.

## Definition of done

- Lens source caches keyed and cleared by `(tenant, model)` through `cacheReference`.
- The `onWrite` declaration, with `rebuild` riding the rolling-cache refresh job.
- A test: create a sourced row; the next `resolveSourceValues` offers it.
- Zealot port ticket linked here.
