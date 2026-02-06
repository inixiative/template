# FEAT-005: Audit Logs

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Implement comprehensive audit logging system to track all mutations with before/after state, actor tracking, and retention policies. Critical for compliance and debugging.

## Key Components

- **Schema**: AuditLog model (design already in TODO.md)
- **Hook integration**: Automatic logging via mutation lifecycle
- **Sensitive field filtering**: Redact passwords, tokens
- **Async writes**: Non-blocking log writes
- **Query interface**: Filter by user, model, date range
- **Retention policies**: Auto-archive old logs
- **Export**: CSV/JSON download for compliance
- **Search**: Full-text search across logs

## Schema (from TODO.md)

```prisma
model AuditLog {
  id          String   @id @default(dbgenerated("uuidv7()"))
  createdAt   DateTime @default(now())

  // Who
  userId      String?
  tokenId     String?
  ipAddress   String?
  userAgent   String?

  // What
  action      String   // 'create' | 'update' | 'delete'
  model       String   // 'User', 'Organization', etc.
  recordId    String

  // Changes
  before      Json?    // Previous state
  after       Json?    // New state
  changes     Json?    // Diff

  @@index([userId])
  @@index([model, recordId])
  @@index([createdAt])
}
```

## Reference

- TODO.md: Lines 26-62 (Complete schema + implementation notes)

## Related Tickets

- **Blocked by**: None
- **Blocks**: None

---

_Stub ticket - expand when prioritized. Design already complete in TODO.md_
