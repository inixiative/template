# FEAT-002: Notes System (Polymorphic)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Port notes system from Carde with false polymorphism pattern (ownerModel + polymorphic foreign keys). Support attaching notes to any entity (User, Organization, Space, etc.).

## Key Components

- **Schema**: Note model with polymorphic ownership
- **API**: CRUD endpoints for notes
- **Permissions**: Notes inherit owner permissions
- **Search**: Full-text search across notes

## Reference

- TODO.md: Line 159 (Modules to Port - Notes system)
- Source: `~/Carde.io/organized-play-api` (notes module)
- Pattern: Use `ownerModel` + polymorphic fields like FeatureFlag design

## Related Tickets

- **Blocked by**: None
- **Blocks**: None

---

_Stub ticket - expand when prioritized_
