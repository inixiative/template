# FEAT-002: Notes System (Polymorphic)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-10-01

---

## Overview

Falsely-polymorphic notes: a `Note` row carries a `subjectModel` discriminator plus one FK column per enabled model, registered in the polymorphism registry. Any model can opt in to notes. A note-enabled model's single read returns its notes, and the notes respect permissions on who can see them.

## Key Components

- **Schema**: `Note` with `subjectModel` + per-model subject FKs, registered in the false-polymorphism registry (no separate notes registry).
- **API**: submodel create `POST /{model}/{id}/notes`; `PATCH` and `DELETE /notes/{id}`. Only the author edits or deletes.
- **Reads**: notes ride the resource-context include on single reads. They are not added to paginated reads.
- **Visibility**: an enum broad enough to cover each audience a note can have (e.g. author only / org / participants on the record). The author always sees their own note.
- **Author**: taken from the actor context, so any actor kind can write a note, not just org users.
- **Not audited**: the author columns record who wrote the note.

## Reference

- Zealot: ZLT-5190 (generalizing the existing `Note` from ZLT-3129)
- Source: `~/Carde.io/organized-play-api` (notes module)

## Related Tickets

- **Blocked by**: None
- **Blocks**: None

---

_Stub ticket - expand when prioritized_
