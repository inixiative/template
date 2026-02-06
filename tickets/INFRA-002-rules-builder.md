# INFRA-002: Rules Builder (Separate Repo)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Build a separate repository for the visual rules builder UI component. This will be used for feature flags, email rules, notification rules, and permission rules.

## Key Components

- **Visual builder**: Drag-and-drop rule composition
- **Rule engine**: JSON Rules Engine compatible output
- **Operators**: Comparison, logical, membership, regex, etc.
- **Type safety**: TypeScript schemas for rule definitions
- **Preview**: Test rules against sample data

## Use Cases

- Feature flag targeting
- Email automation rules
- Notification rules
- Permission conditions
- Approval workflows

## Reference

- TODO.md: Feature flags mention JSON rule targeting
- Existing: JSON Rules Engine patterns in codebase

## Related Tickets

- **Blocked by**: None
- **Blocks**: COMM-001 (Email system), FEAT-008 (Permissions builder)

---

_Stub ticket - expand when prioritized. Consider open-sourcing as standalone package._
