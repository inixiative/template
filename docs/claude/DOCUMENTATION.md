# Documentation

<!-- toc:start -->

## Contents

- [Workflow](#workflow)
- [Before Starting Work](#before-starting-work)
- [Doc Structure](#doc-structure)
  - [TOC Required](#toc-required)
  - [Standard Sections](#standard-sections)
  - [Stub Format](#stub-format)
  - [Code Examples](#code-examples)
  - [Diagrams with Mermaid](#diagrams-with-mermaid)
- [Doc Maintenance](#doc-maintenance)
  - [After Implementing Features](#after-implementing-features)
  - [Keep Docs Honest](#keep-docs-honest)
- [Doc Alignment Review](#doc-alignment-review)
  - [Process](#process)
  - [Example Review Findings](#example-review-findings)
  - [Review Prompt Template](#review-prompt-template)
  - [When to Run](#when-to-run)

<!-- toc:end -->


---

## Workflow

```
1. Before implementing → read the relevant doc
2. After implementing → update the doc if behavior or a contract changed
3. Open questions and planned work → tickets/ (not docs/claude/)
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

## Doc Structure

### TOC Required

Every doc carries a generated contents list between the `toc:start` / `toc:end` HTML comment markers. Regenerate after adding or removing headings: `bun run docs:toc` (`scripts/docs/regenToc.ts`, which covers `docs/claude/**`, `FEATURES.md`, `COMPARISONS.md`, `TODO.md`, `README.md`).

### Standard Sections

One `# Title`, the TOC markers, a one-line purpose, then `##` sections separated by `---`. Keep it terse; reference what the code does, not how it was arrived at.

### Stub Format

For incomplete docs:

```markdown
# Topic

> Stub - to be expanded


---

## Section

TODO: Document X
```

### Code Examples

Always include real usage:

```typescript
// Good - shows actual pattern
import { cache, cacheKey } from '@template/db';
const user = await cache(cacheKey('user', userId), () => db.user.findUnique(...));

// Not just signatures
cache<T>(key: string, fn: () => Promise<T>, ttl?: number | ((value: T) => number)): Promise<T>
```

### Diagrams with Mermaid

Use [Mermaid](https://mermaid.js.org/) for flowcharts, sequence diagrams, and architecture diagrams. GitHub renders Mermaid blocks natively.

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
- **Regenerate the TOC** (`bun run docs:toc`) when adding/removing sections

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
