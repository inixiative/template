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

## Business-Side Skills (from mauriff)

Separate from the coding skills, adapted versions of Mauricio's skills for template users asking "I built this, now what?":

- **Product Ideation** — adapted with template context (what the platform already provides, what needs to be built on top)
- **Business Execution** — the 10-dimension planning framework, pre-populated with what the template handles (auth, multi-tenancy, permissions) so the plan focuses on what's actually missing
- **Go-to-Market** — pricing, positioning, launch planning for a SaaS built on the template

These could live alongside the coding skills but serve a completely different user moment.

---

## Open Questions

1. **Cartographer context budget** — 18k lines of docs is manageable for a routing-only agent, but should we also include sample code from the codebase? That could balloon quickly.
2. **Skill format** — `.claude/commands/` (Claude Code native) vs `AI/skills/` (template convention)? The former integrates with `/skill-name` invocation.
3. **Interaction log schema** — What events matter? Task type, docs referenced, corrections made, time-to-completion? Need to define this before building.
4. **Foundry integration** — If Foundry matures, it could test our skills: give the Cartographer a task, measure whether its routing produces good outcomes, iterate on the corpus. This is the "recursion engine" concept.
5. **Personal public vault provisioning** — Per-user vaults on shared Railway instance? Or a single vault with user-scoped tags? Tradeoffs around isolation vs simplicity.
6. **Librarian trigger** — Always-on (classifies every interaction) vs on-demand (user says "remember this")? Always-on is powerful but noisy and expensive.

## Next Steps

1. Build the Cartographer skill with full docs loaded
2. Build the Librarian skill with classification + promotion logic
3. Build 2-3 domain execution skills to prove the handoff pattern
4. Add Hivemind to docker-compose and Railway init
5. Define the personal public vault schema and provisioning
6. Adapt Mauricio's business skills for template context
7. Measure: does the two-layer approach actually outperform just dumping everything in context?
