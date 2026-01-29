# Documentation

## Contents

- [Workflow](#workflow)
- [Before Starting Work](#before-starting-work)
- [Writing Notes](#writing-notes)
- [Doc Structure](#doc-structure)

---

## Workflow

```
1. Capture ideas → docs/RAW_NOTES.md
2. Periodically sort → docs/claude/<topic>.md
3. Before implementing → read relevant doc
4. After implementing → update doc if needed
```

---

## Before Starting Work

**Always read the relevant doc first.**

| Task | Read First |
|------|------------|
| Adding an endpoint | API_ROUTES.md |
| Schema changes | DATABASE.md |
| Adding a hook | HOOKS.md |
| Background job | JOBS.md |
| Permission check | PERMISSIONS.md |
| Caching | REDIS.md |
| New package/dep | DEPENDENCIES.md, MONOREPO.md |

The docs contain patterns, conventions, and decisions. Reading them prevents:
- Reinventing existing utilities
- Breaking established patterns
- Missing required steps (hooks, cache invalidation, etc.)

---

## Writing Notes

### RAW_NOTES.md

Dump thoughts, ideas, and discoveries here:

```markdown
## 2024-01-29

- found edge case in token permissions when org is deleted
- maybe we need cascading deletes?
- look at how zealot handles this

## 2024-01-28

- webhook retry logic could use exponential backoff
- currently fixed 5 min delay
```

### When to Sort

Periodically (or when RAW_NOTES gets long):
1. Review accumulated notes
2. Move relevant content to topic docs
3. Delete or archive processed notes

### Sorting Examples

| Raw Note | Destination |
|----------|-------------|
| "tokens can't exceed user's org role" | PERMISSIONS.md |
| "use `bun run db:push` not migrate in dev" | SCRIPTS.md |
| "cache keys should include orgId" | REDIS.md |
| "need to add email provider" | COMMUNICATIONS.md |

---

## Doc Structure

### Standard Sections

```markdown
# Topic

## Contents
- [Section 1](#section-1)
- [Section 2](#section-2)

---

## Section 1

Content...

---

## Section 2

Content...
```

### Stub Format

For incomplete docs:

```markdown
# Topic

> Stub - to be expanded

## Contents
...

---

## Section

TODO: Document X
```

### Code Examples

Always include real usage:

```typescript
// Good - shows actual pattern
import { cache } from '#/lib/cache/cache';
const user = await cache('user', userId, () => db.user.findUnique(...));

// Not just signatures
cache(prefix: string, key: string, fn: () => Promise<T>): Promise<T>
```

---

## Doc Maintenance

### After Implementing Features

Update docs when you:
- Add new patterns others should follow
- Change existing conventions
- Add new utilities or helpers
- Discover gotchas worth documenting

### Keep Docs Honest

- Remove outdated information
- Mark incomplete sections as stubs
- Don't document aspirational features as if they exist
