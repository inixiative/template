# Documentation

## Contents

- [Workflow](#workflow)
- [Before Starting Work](#before-starting-work)
- [Writing Notes](#writing-notes)
- [Doc Structure](#doc-structure)
- [Doc Maintenance](#doc-maintenance)
- [Doc Alignment Review](#doc-alignment-review)

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

### TOC Required

Every doc must have a `## Contents` section at the top with links to all major sections. This helps Claude (and humans) quickly navigate.

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

### Diagrams with Mermaid

Use [Mermaid](https://mermaid.js.org/) for flowcharts, sequence diagrams, and architecture diagrams. Mermaid is installed at the project root.

```markdown
```mermaid
flowchart TD
    A[Request] --> B{Auth?}
    B -->|Yes| C[Handler]
    B -->|No| D[401]
    C --> E[Response]
`` `

```mermaid
sequenceDiagram
    Client->>API: POST /inquiry
    API->>DB: Create inquiry
    API->>Queue: Enqueue webhook
    API-->>Client: 201 Created
    Queue->>Webhook: POST to subscriber
`` `
```

Common diagram types:
- `flowchart` - Process flows, decision trees
- `sequenceDiagram` - API flows, async operations
- `erDiagram` - Data relationships
- `classDiagram` - Type hierarchies

---

## Doc Maintenance

### After Implementing Features

Update docs when you:
- Add new patterns others should follow
- Change existing conventions
- Add new utilities or helpers
- Discover gotchas worth documenting
- **Keep TOC updated** when adding/removing sections

### Keep Docs Honest

- Remove outdated information
- Mark incomplete sections as stubs
- Don't document aspirational features as if they exist

---

## Doc Alignment Review

Periodically verify docs match the actual codebase.

### Process

1. **Spawn review agents** - For each doc, have an agent read the doc then explore the corresponding code
2. **Identify discrepancies** - Types of issues:
   - **Dead code** - Code exists but isn't used (delete it)
   - **Orphaned docs** - Doc describes non-existent feature (remove or mark as TODO)
   - **Outdated docs** - Code changed but doc wasn't updated (fix doc)
   - **Missing docs** - Feature exists but isn't documented (add to doc)
   - **Unwired code** - Code exists but isn't connected (wire it up or delete)
3. **Fix one by one** - Go through each issue, decide action, implement

### Example Review Findings

| Finding | Type | Action |
|---------|------|--------|
| `entitlements.ts` defines type but nothing imports it | Dead code | Delete file |
| Two OpenTelemetry implementations, neither called | Unwired code | Keep one, wire it up, delete other |
| Doc says pg-init.sh creates extension, code doesn't | Outdated docs | Fix doc to match code |
| Doc shows flat type, code uses nested type | Outdated docs | Verify which is correct, align |
| Validation middleware exists but not in docs | Missing docs | Add to doc |

### Review Prompt Template

```
Review the <TOPIC> documentation against actual code.

1. Read docs/claude/<TOPIC>.md
2. Explore the corresponding code in <PATHS>
3. Verify: Does the doc accurately describe how the feature works?

Report: What's accurate, what's missing, what's outdated.
```

### When to Run

- Before major releases
- After large refactors
- When onboarding (fresh eyes catch staleness)
- Quarterly maintenance
