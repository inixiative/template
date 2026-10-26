# INFRA-040 — A declared tag on a lens source, passed through `toSourceQueries`

**Status:** 🆕 Not Started · **Line:** INFRA · **Priority:** Low · **Related:** Zealot ZLT-5983 (item 2), ZLT-5975 (#2987), INFRA-024

## Context

Zealot reads every lens source through one function, `resolveSourceValues(lens, tenant)`. Most
sources run the default executor (a DISTINCT query, cached 10 minutes). One source, enrichment
values, is served from a rolling dictionary cache instead. Choosing the executor needs to know which
source a query is. Today Zealot works that out after the fact: `LENS_SOURCE_TAGS` / `sourceTagOf`
match the compiled query's model and field names against a table.

That is a syntactic proxy for a fact the lens declaration already knows. Rename a field, or declare a
second source on the same model, and the match silently picks the wrong executor.

## Shape

- `SourceSpec` gains an optional `tag: string`.
- `toSourceQueries` copies it onto the `SourceQuery`; `materializeSourceQuery` copies it onto
  `SourceValues`. The engine never reads it.
- Composition: a child narrowing inherits a parent's tag and may not change it (`validateNarrowing`
  issue), so routing cannot drift between layers.

The caller keeps the routing table (`tag → executor`). Caching and Redis stay out of the engine.

## Note

Aron ruled on 2026-10-21 to keep the tag Zealot-local until a second consumer needed it. On
2026-10-26 he asked for this ticket, as one of the things built in Zealot that fit better in the
engine. The template's builder surface (INFRA-017) is the likely second consumer.

## Definition of done

- `tag` on `SourceSpec`, carried to `SourceQuery` and `SourceValues`, with a narrowing test.
- Zealot deletes `LENS_SOURCE_TAGS` / `sourceTagOf` and declares tags in its lenses.
