# AUTH-012 — Placing sided records

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Low · **Related:** AUTH-008, permissions 0.12

## Context

Records hang from two parents of one model on different polymorphic axes: an inquiry's `sourceOrganization` and `targetOrganization` (`sourceModel` / `targetModel`), a customer ref's customer and provider. Placement is path-driven in the library (`placeUnder(map, resource, path, anchorResource, anchor)`): the path names the relation, so the side is never guessed.

## To do

- Create and collection routes for sided records (inquiries, customer refs) placed under an organization, space or member name their path (`targetOrganization`, `sourceSpace`, …) and place with `placeUnder`.
- Tests per side: a record placed on one side is never judged as the other.
