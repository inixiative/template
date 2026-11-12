# AUTH-012 — Placing sided records

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Low · **Related:** AUTH-008, permissions 0.12

## Context

Records hang from two parents of one model on different polymorphic axes: an inquiry's `sourceOrganization` and `targetOrganization` (`sourceModel` / `targetModel`), a customer ref's customer and provider. Placement is path-driven in the library (`placeUnder(map, resource, path, anchorResource, anchor)`): the path names the relation, so the side is never guessed.

## To do

- The inquiry routes under an organization or space name their path and place with `placeUnder`, in place of `validatePermission` on the parent and `resolveInquirySource`:
  - `organizationCreateInquiry`, `spaceCreateInquiry` (`sourceOrganization`, `sourceSpace`)
  - `organizationReadManyInquiriesSent`, `spaceReadManyInquiriesSent` (`sourceOrganization`, `sourceSpace`)
  - `organizationReadManyInquiriesReceived`, `spaceReadManyInquiriesReceived` (`targetOrganization`, `targetSpace`)
- Tests per side: a record placed on one side is never judged as the other.
