# AI Skills Strategy

Notes on building a skills layer for the template, informed by research into existing approaches.

## Context

The template has a rich `docs/claude/` knowledge base (~18k lines across 35 docs) and an AI memory system (MuninnDB) but no skills layer yet. The question: how do we give AI agents structured, reusable workflows for both building within the template and building a business on top of it?

## Prior Art

### mauriff/claude-skills-starter

Four skills focused on the product-to-prototype pipeline:

- **Product Ideation** — Structured interrogation (problem validation, differentiation, first user, value capture, kill question) through four phases: idea sharpening, market sizing, PRD generation, and "cold read" validation.
- **MVP Architecture Engineer** — Transforms a PRD into a technical blueprint. Opinionated: no microservices for MVPs, max 3 external services, monolithic-modular, ADRs for every decision, "scaling triggers" that tell you when to change.
- **PRD-to-Prototype** — Turns a PRD into a standalone React prototype. Selective fidelity (high on critical flows, low on periphery), realistic mock data, single-file .jsx output. Adapts for audience: investor demo vs user test vs dev handoff.
- **Business Execution Orchestrator** — COO/Chief of Staff skill. Takes PRD + architecture and produces a plan across 10 dimensions (product, tech, legal, finance, brand, GTM, ops, team, procurement, data). Three horizons: pre-launch, launch, operate.

**What's useful for us:** These aren't about writing code in a specific codebase — they're about *thinking through a product*. For someone who built a template and is asking "now what?", these are the missing upstream skills: ideation, market validation, business planning. We should adapt these for template users.

### inixiative/foundry

A system for measuring and improving AI corpus (the docs/prompts/conventions that shape AI output). Key concepts:

- **Three-agent testing**: Orchestrator coordinates an Implementer (agent under test), Subject (vague PM), and Oracle (judge with golden implementation). Physically isolated via git branches.
- **Scoring rubrics**: Prompt efficiency (quality / tokens), completion, demerits (rules broken), craft (pattern adherence), questioning quality.
- **Corpus layering**: Global (foundry baseline) → Project (repo-specific) → Personal (local, gitignored). Immutable snapshots with content hashes for reproducibility.
- **Core thesis**: Model improvements plateau, tool improvements are generic, but corpus is where the actual leverage is — and most organizational corpus actively degrades performance through rule bloat.

### inixiative/hivemind

Multi-agent coordination via shared event log. MCP server that tracks agents, plans, tasks, and events. SQLite-backed. Works in local (stdio, process-tracked) or network (HTTP, heartbeat-tracked) mode. Structured event types: agent registration, plan lifecycle, task state, decisions, questions, answers, notes.

**Relationship to MuninnDB:** Hivemind and MuninnDB solve different problems. MuninnDB is *memory* (facts, decisions, patterns — persistent knowledge). Hivemind is *coordination* (who's doing what right now — ephemeral state). Hivemind could become a first-class template dependency: snippet in docker-compose for local, hosted on Railway for shared. It could consume MuninnDB as its memory backend rather than duplicating storage.

## The Tension

Two competing findings:

1. **Context bloat degrades performance.** Foundry's own research confirms this — rule bloat causes instruction-following to decay exponentially. More docs in context doesn't mean better output.
2. **Skills and sub-agents, when scoped right, are powerful.** Targeted context beats broad context. The right 500 lines outperform 18,000 lines every time.

The resolution: pay the context cost once at a routing layer that reads everything but does nothing, then hand lean, precise slices to execution agents.

---

## The Big Picture: Three Skills + Four-Tier Memory

### Skill 1: The Cartographer (entry-point router)

A "read everything, do nothing" agent. Its job:

1. Load the full template docs, codebase map, and conventions into its context
2. Receive a user's intent (e.g., "I need to add webhook retry logic")
3. Having *actually read* everything, carve out precisely which docs, patterns, and reference files the execution agents need
4. Hand off a targeted context bundle — a slice of itself — to the right execution agents
5. It does NOT implement. It routes.

The Cartographer can afford to be expensive because it prevents the execution agents from being wasteful. It pays the token cost once where precision matters most.

### Skill 2: The Librarian (classification and memory routing)

Every interaction with an AI agent produces knowledge. The Librarian classifies it and routes it to the right memory tier. When a developer says something, the Librarian determines:

- **What kind of memory is this?** (scratch thought, status update, team decision, org convention)
- **Where should it live?** (which tier, which vault, what tags/concepts)
- **Should anything be promoted?** (local scratch → team decision after validation)

The Librarian uses MuninnDB's existing primitives:

| MuninnDB primitive | How the Librarian uses it |
|---|---|
| `muninn_remember` with vault/concept/tags | Route to the right tier with proper classification |
| `muninn_link` | Connect related memories across tiers (a decision links to the scratch work that led to it) |
| `muninn_evolve` | Update memories when understanding changes, preserving history |
| `muninn_decide` | Record decisions with rationale and evidence links |
| `muninn_state` | Manage lifecycle (draft → validated → promoted → archived) |
| `muninn_consolidate` | Merge scattered scratch notes into a clean team memory |

### Skill 3: Domain Executors (spawned by the Cartographer)

Focused agents that receive only what they need:

- **API Route** — API_ROUTES.md + AUTH.md + a reference endpoint from the codebase
- **DB Model** — DATABASE.md + HOOKS.md + a reference model + factory patterns
- **Frontend Feature** — FRONTEND.md + ZUSTAND.md + a reference component
- **Permissions** — PERMISSIONS.md + AUTH.md + reference permission setup
- **Jobs/Workers** — JOBS.md + REDIS.md + a reference job
- **Init Script Task** — INIT_SCRIPT_PATTERNS.md + reference task

Each is small, focused, and performs well because it has *just enough* context.

---

## Four-Tier Memory Model

Memory isn't just "local vs shared." It maps to human organizational reality:

### Tier 1: Personal Private

- **Who reads:** Just you and your agent
- **What goes here:** Scratch work, draft ideas, frustrations, "I think this code is wrong but I'm not sure yet," half-formed hypotheses
- **Storage:** Local only. No sync. No cloud. Architecturally isolated — not "we promise not to read it" but "it physically cannot leave your machine"
- **MuninnDB vault:** `local` (already exists), stored on local filesystem via docker volume
- **Lifecycle:** Ephemeral by default. Explicitly promote to make durable.

### Tier 2: Personal Public

- **Who reads:** You, your agent, your PM's agent, your manager's agent — anyone with team access who wants to know what you're working on
- **What goes here:** "Working on webhook retry logic, blocked on Redis connection pooling, ETA tomorrow." Current status, work-in-progress context, questions you're trying to answer.
- **Storage:** Cloud-synced. Readable by team agents on demand.
- **MuninnDB vault:** New vault, e.g. `personal_public_{user}` — hosted on Railway alongside team vault
- **Use case:** PM asks their agent "what's the team working on?" — the agent queries each team member's personal public vault and synthesizes a status report. No standup needed.

### Tier 3: Team

- **Who reads:** All agents and developers on the project
- **What goes here:** Validated decisions ("we use exponential backoff for webhooks — here's why"), resolved bugs with root cause, established patterns, architectural choices
- **Storage:** Shared cloud instance (Railway)
- **MuninnDB vault:** `team` (already exists)
- **Lifecycle:** Only promoted here after validation. A scratch idea becomes a team decision after the code works and the pattern is confirmed.

### Tier 4: Organization

- **Who reads:** All projects, all teams within the org
- **What goes here:** Cross-project conventions ("our company uses SOC2 compliance patterns"), org-wide technical standards, shared infrastructure decisions
- **Storage:** Shared cloud instance, org-level
- **MuninnDB vault:** New vault, e.g. `org` — could be a separate MuninnDB instance or a vault on the same Railway deployment
- **Lifecycle:** Promoted from team after adoption across multiple projects

### The Promotion Flow

```
Personal Private  ──promote──►  Personal Public  ──promote──►  Team  ──promote──►  Org
   (scratch)                     (status/WIP)                (validated)          (standard)
```

Each promotion is explicit. The Librarian can suggest promotions ("this pattern worked in 3 PRs — promote to team?") but a human approves. Knowledge doesn't leak upward by accident.

### What Needs to Be Built

MuninnDB already has the storage primitives (vaults, concepts, tags, links, lifecycle states). What's missing is the *policy layer*:

1. **Classification** — When you say something to an agent, it needs to decide: private scratch, status update, team decision, or org convention? The Librarian skill handles this.
2. **Promotion workflow** — `muninn_evolve` + `muninn_state` can track lifecycle, but we need UX for "promote this" actions and Librarian suggestions.
3. **Access control** — Vault-level isolation in MuninnDB. Personal private = local vault only. Personal public = user-scoped vault on shared instance. Team/org = shared vaults with appropriate access.
4. **Query routing** — When an agent needs context, which tiers does it search? The Cartographer should know: "for this coding task, search team + template vaults. For status, search personal public."

---

## The Policy Pipeline: Memory → Docs → Corpus

MuninnDB memories are fluid — they evolve, decay, get consolidated. But at some point, validated knowledge needs to become *formal policy*: the `docs/claude/` files that shape agent behavior. This is a maturity pipeline.

### The Problem with Docs in Git

The current `docs/claude/` files are static markdown checked into git. This works, but has real friction:

1. **No lifecycle metadata** — A doc is either in the repo or it isn't. There's no way to say "this section is in development," "this pattern is deprecated," or "this convention isn't active yet."
2. **Format lock-in** — Markdown is great for humans, but agents might benefit from graph relationships (Neo4j), vector embeddings, or pre-tokenized formats. Right now everything is flat text.
3. **Merge conflicts on knowledge** — Multiple people updating conventions creates git conflicts on docs, which is awkward because knowledge isn't really "mergeable" the way code is.
4. **No visibility into what's coming** — PMs and team leads can't see what conventions are being proposed, tested, or deprecated without reading git diffs.

### Doc Lifecycle States

Every piece of documentation (or section within a doc) should carry a lifecycle state:

| State | Meaning | Agent behavior |
|-------|---------|---------------|
| `draft` | Being worked on, not validated | Agents ignore unless explicitly asked |
| `development` | Active but experimental, being tested | Agents follow but flag as experimental |
| `active` | Validated, stable convention | Agents follow as policy |
| `deprecated` | Being phased out, replacement exists | Agents warn if referenced, suggest replacement |
| `archived` | No longer relevant, kept for history | Agents ignore completely |

This is essentially feature flags for documentation.

### The Pipeline

```
MuninnDB (fluid)          Formal Docs (structured)         Corpus (optimized)

  muninn_remember    ──►   Draft doc/section          ──►   Tokenized/indexed
  muninn_evolve            with lifecycle tag                for agent consumption
  muninn_decide
       │                        │                              │
       │ Librarian              │ Librarian                    │ Cartographer
       │ classifies             │ promotes                     │ routes
       │                        │                              │
  Scratch/WIP           Development/Active              Pre-compiled context
  in vaults             in docs (git or external)       bundles for executors
```

### Where Should Formal Docs Live?

Git is convenient but not ideal for living documentation. Options:

| Approach | Pros | Cons |
|----------|------|------|
| **Git + frontmatter** | Simple, versioned, existing workflow | Merge conflicts, no real-time visibility, lifecycle tags clutter diffs |
| **MuninnDB all the way** | Fluid lifecycle, agent-native, no merge conflicts | Not human-browsable, no git history, single point of failure |
| **Hybrid: git as source of truth, MuninnDB as runtime cache** | Best of both — humans edit markdown, pipeline syncs to MuninnDB with enrichment (vectors, graph links, lifecycle) | More moving parts, sync complexity |
| **External doc platform** (Notion/Confluence-like) | Real-time collaboration, lifecycle features built in | Another dependency, not git-integrated |

The hybrid approach is probably right: `docs/claude/` stays as the human-editable source of truth, but a pipeline process enriches and syncs to MuninnDB where agents actually consume it. The enrichment step can:

- Add vector embeddings for semantic search
- Build graph relationships between doc sections
- Apply lifecycle tags from frontmatter
- Pre-tokenize for efficient agent consumption
- Track which docs are referenced most (usage analytics feeding back to the Librarian)

### Frontmatter Convention for Doc Lifecycle

If we go with git + frontmatter, docs could carry metadata:

```markdown
---
status: active
since: 2026-01-15
supersedes: null
deprecated_by: null
owners: [backend-team]
last_validated: 2026-03-01
---

# API Routes

...actual content...
```

Sections within a doc could use inline tags:

```markdown
## Batch Operations <!-- status: development -->

This pattern is being tested...

## Legacy Webhook Format <!-- status: deprecated, see: #new-webhook-format -->

Old format, will be removed in Q3...
```

### The Corpus Compilation Step

This is what Foundry calls "corpus layering." The pipeline compiles raw docs into an optimized format:

1. **Filter by lifecycle** — Strip `draft` and `archived` sections, annotate `deprecated` and `development`
2. **Resolve references** — Inline cross-doc links, expand "see also" into actual content
3. **Build graph** — Which docs reference which, dependency relationships
4. **Embed** — Vector embeddings for semantic retrieval
5. **Hash** — Content hash for reproducibility (Foundry's immutable snapshot concept)

The compiled corpus is what the Cartographer actually loads. Not the raw markdown — the processed, lifecycle-aware, enriched version.

---

## Hivemind as First-Class Dependency

Hivemind solves the coordination problem that MuninnDB doesn't: real-time multi-agent awareness.

**When you need it:** Multiple Claude sessions working on the same repo simultaneously. Without coordination, Agent A refactors the auth module while Agent B is adding a new auth flow — conflict.

**Integration plan:**
- Add to `docker-compose.yml` for local multi-agent development
- Add to Railway deployment via init script (PR pending)
- Hivemind consumes MuninnDB for persistent memory, provides ephemeral coordination on top
- Event log feeds back into the Librarian for interaction capture

**Not needed yet** for single-agent workflows, but the architecture should assume it's coming.

---

## RACI for Agent Roles

Multi-agent systems have the same problem that human organizations have: unclear ownership leads to duplicated work, dropped balls, and diffused accountability. RACI (Responsible, Accountable, Consulted, Informed) maps cleanly onto agent roles.

### The RACI Matrix

| Activity | Cartographer | Librarian | Domain Executor | Hivemind | Human |
|---|---|---|---|---|---|
| Classify an interaction | I | **R** | - | I | **A** |
| Route task to executor | **R** | C | I | I | **A** |
| Write code | - | - | **R** | I | **A** |
| Review code | - | - | **R** (reviewer executor) | I | **A** |
| Promote memory tier | I | **R** | - | I | **A** |
| Compile corpus | **R** | C | - | - | **A** |
| Coordinate parallel agents | I | - | I | **R** | **A** |
| Record decision | - | **R** | C | I | **A** |
| Deprecate a doc | C | **R** | - | - | **A** |
| Validate against conventions | - | C | **R** (validator executor) | I | **A** |

**Key constraint:** Exactly one **A** per row. For agents, this prevents the common failure mode of overlapping work with no owner.

### Where the Human Sits

Notice the pattern: humans are almost always **A** (accountable), rarely **R** (responsible). Agents do the work, humans own the outcome. The human approves promotions, signs off on code, blesses policy changes. Agents propose, execute, classify.

This is the right posture *for now*. But it's also the bottleneck.

### The Trust Problem

Right now, the same small team writes code, reviews code, and validates code. That's not sustainable, and it's exactly where we want AI to take on more R *and* eventually more A. But we can't just hand over accountability — trust needs to be built incrementally.

The path toward earned trust:

```
Phase 1 (now):     Human = A for everything. Agent = R for execution only.
Phase 2 (near):    Agent = A for low-risk (formatting, test coverage, doc updates).
                   Human = A for high-risk (architecture, security, data model).
Phase 3 (future):  Agent = A for most execution. Human = A for strategy and promotion.
```

Each phase transition happens when we have *evidence* that agents handle A reliably at the current tier. Foundry's scoring rubrics (completion, demerits, craft) could provide that evidence — you don't promote an agent's accountability level on vibes, you promote it on measured performance.

### Guardian Skills: "Don't Fuck It Up" Agents

This reframes some domain executors not as builders but as *guardians*. Their job isn't to write code — it's to make sure code doesn't break things. Different role-play, different persona, different success criteria.

| Guardian Skill | Role | What it watches for |
|---|---|---|
| **Convention Guard** | Validates code against established patterns | Import aliases, file structure, naming, anti-patterns |
| **Security Guard** | Reviews for OWASP top 10, auth gaps, tenant boundary violations | Injection, XSS, missing permission checks, leaked secrets |
| **API Contract Guard** | Ensures API changes don't break consumers | Breaking schema changes, missing versioning, response shape drift |
| **Test Coverage Guard** | Validates that changes have appropriate test coverage | Missing factories, untested branches, integration gaps |
| **Performance Guard** | Flags N+1 queries, missing indexes, unbounded queries | Query patterns, pagination, cache usage |

These guardians are the "make sure this thing isn't fucking up" agents. They don't build — they watch. And critically, they have a different relationship to RACI: they're **R** for validation, and the human is **A** for deciding whether to act on their findings.

The role-play matters here. A builder agent's persona is "implement this feature." A guardian's persona is "find everything wrong with this change." Different framing produces genuinely different behavior from the model — the guardian is adversarial by design, which counteracts the model's natural tendency to be agreeable and say everything looks fine.

### RACI + Memory Tiers

The promotion flow maps directly onto RACI accountability handoffs:

| Promotion | R (proposes) | A (approves) |
|---|---|---|
| Personal private → personal public | Developer (self-promote) | Developer |
| Personal public → team | Librarian | Developer or tech lead |
| Team → org | Librarian | Architect or eng manager |
| Convention → guardian rule | Librarian + Convention Guard | Tech lead |

Each tier increase requires a higher-authority **A**. Knowledge doesn't leak upward because there's always a human accountable for the promotion. As trust builds (Phase 2, Phase 3), some of these A roles can shift to agents with proven track records.

---

## Business-Side Skills (from mauriff)

Separate from the coding skills, adapted versions of Mauricio's skills for template users asking "I built this, now what?":

- **Product Ideation** — adapted with template context (what the platform already provides, what needs to be built on top)
- **Business Execution** — the 10-dimension planning framework, pre-populated with what the template handles (auth, multi-tenancy, permissions) so the plan focuses on what's actually missing
- **Go-to-Market** — pricing, positioning, launch planning for a SaaS built on the template

These could live alongside the coding skills but serve a completely different user moment.

---

## Open Questions

1. **Cartographer context budget** — 18k lines of docs is manageable for a routing-only agent, but should we also include sample code from the codebase? That could balloon quickly. Does it load raw markdown or compiled corpus?
2. **Skill format** — `.claude/commands/` (Claude Code native) vs `AI/skills/` (template convention)? The former integrates with `/skill-name` invocation.
3. **Interaction log schema** — What events matter? Task type, docs referenced, corrections made, time-to-completion? Need to define this before building.
4. **Foundry integration** — If Foundry matures, it could test our skills: give the Cartographer a task, measure whether its routing produces good outcomes, iterate on the corpus. This is the "recursion engine" concept.
5. **Personal public vault provisioning** — Per-user vaults on shared Railway instance? Or a single vault with user-scoped tags? Tradeoffs around isolation vs simplicity.
6. **Librarian trigger** — Always-on (classifies every interaction) vs on-demand (user says "remember this")? Always-on is powerful but noisy and expensive.
7. **Doc lifecycle adoption** — Frontmatter in existing docs? Inline section tags? Or external metadata file that maps doc paths to lifecycle states? Need to pick one and migrate.
8. **Corpus storage backend** — Pure MuninnDB? MuninnDB + vector store (pgvector in existing Postgres)? Neo4j for graph relationships? Or is MuninnDB's built-in Hebbian associations + BM25 + vector search sufficient without adding another database?
9. **Corpus compilation trigger** — On git push (CI step)? On `bun run setup`? On-demand via a skill? Needs to be automatic enough that docs don't drift from compiled corpus.
10. **External doc visibility** — Does the living doc state (what's draft, what's deprecated, what's being proposed) need a UI? Or is agent-queryable via MuninnDB sufficient? PMs might want a dashboard.

## Next Steps

1. Build the Cartographer skill with full docs loaded
2. Build the Librarian skill with classification + promotion logic
3. Build 2-3 domain execution skills to prove the handoff pattern
4. Add Hivemind to docker-compose and Railway init
5. Define the personal public vault schema and provisioning
6. Add frontmatter lifecycle tags to existing `docs/claude/` files
7. Build the corpus compilation pipeline (docs → MuninnDB enrichment)
8. Adapt Mauricio's business skills for template context
9. Measure: does the two-layer approach actually outperform just dumping everything in context?
