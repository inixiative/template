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

**What's useful for us:** These aren't about writing code in a specific codebase — they're about *thinking through a product*. For someone who built a template and is asking "now what?", these are the missing upstream skills: ideation, market validation, business planning.

### inixiative/foundry

A system for measuring and improving AI corpus (the docs/prompts/conventions that shape AI output). Key concepts:

- **Three-agent testing**: Orchestrator coordinates an Implementer (agent under test), Subject (vague PM), and Oracle (judge with golden implementation). Physically isolated via git branches.
- **Scoring rubrics**: Prompt efficiency (quality / tokens), completion, demerits (rules broken), craft (pattern adherence), questioning quality.
- **Corpus layering**: Global (foundry baseline) → Project (repo-specific) → Personal (local, gitignored). Immutable snapshots with content hashes for reproducibility.
- **Core thesis**: Model improvements plateau, tool improvements are generic, but corpus is where the actual leverage is — and most organizational corpus actively degrades performance through rule bloat.

### inixiative/hivemind

Multi-agent coordination via shared event log. MCP server that tracks agents, plans, tasks, and events. SQLite-backed. Works in local (stdio, process-tracked) or network (HTTP, heartbeat-tracked) mode. Structured event types: agent registration, plan lifecycle, task state, decisions, questions, answers, notes.

**What's useful for us:** The interaction logging pattern. Every correction, question, and redirect during development becomes structured data that can improve the corpus over time.

## The Tension

Two competing findings:

1. **Context bloat degrades performance.** Foundry's own research confirms this — rule bloat causes instruction-following to decay exponentially. More docs in context doesn't mean better output.
2. **Skills and sub-agents, when scoped right, are powerful.** Targeted context beats broad context. The right 500 lines outperform 18,000 lines every time.

## Proposed Architecture: The Cartographer

Rather than many independent skills or one massive context dump, a two-layer system:

### Layer 1: The Cartographer (single entry-point skill)

A "read everything, do nothing" agent. Its job:

1. Load the full template docs, codebase map, and conventions into its context
2. Receive a user's intent (e.g., "I need to add webhook retry logic")
3. Having *actually read* everything, carve out precisely which docs, patterns, and reference files the execution agents need
4. Hand off a targeted context bundle — a slice of itself — to the right execution agents
5. It does NOT implement. It routes.

The key insight: you pay the token cost once at the routing layer where precision matters most. The Cartographer can afford to be expensive because it prevents the execution agents from being wasteful.

### Layer 2: Domain Execution Skills (spawned by the Cartographer)

Focused agents that receive only what they need:

- **API Route** — API_ROUTES.md + AUTH.md + a reference endpoint from the codebase
- **DB Model** — DATABASE.md + HOOKS.md + a reference model + factory patterns
- **Frontend Feature** — FRONTEND.md + ZUSTAND.md + a reference component
- **Permissions** — PERMISSIONS.md + AUTH.md + reference permission setup
- **Jobs/Workers** — JOBS.md + REDIS.md + a reference job
- **Init Script Task** — INIT_SCRIPT_PATTERNS.md + reference task

Each is small, focused, and performs well because it has *just enough* context.

### Layer 3: Interaction Log (Hivemind-style)

Structured event capture during development sessions via MuninnDB:

- What task was attempted
- What docs/patterns were referenced
- What the Cartographer chose to include
- Whether it worked (user corrections, retries)
- Validated patterns promoted from local → team memory

This creates a feedback loop: interactions improve routing over time.

## Business-Side Skills (from mauriff)

Separate from the coding skills, adapted versions of Mauricio's skills for template users asking "I built this, now what?":

- **Product Ideation** — adapted with template context (what the platform already provides, what needs to be built on top)
- **Business Execution** — the 10-dimension planning framework, pre-populated with what the template handles (auth, multi-tenancy, permissions) so the plan focuses on what's actually missing
- **Go-to-Market** — pricing, positioning, launch planning for a SaaS built on the template

These could live alongside the coding skills but serve a completely different user moment.

## Open Questions

1. **Cartographer context budget** — 18k lines of docs is manageable for a routing-only agent, but should we also include sample code from the codebase? That could balloon quickly.
2. **Skill format** — `.claude/commands/` (Claude Code native) vs `AI/skills/` (template convention)? The former integrates with `/skill-name` invocation.
3. **Interaction log schema** — What events matter? Task type, docs referenced, corrections made, time-to-completion? Need to define this before building.
4. **Foundry integration** — If Foundry matures, it could test our skills: give the Cartographer a task, measure whether its routing produces good outcomes, iterate on the corpus. This is the "recursion engine" concept.
5. **Hydration strategy** — Should the Cartographer pre-compile doc bundles for common tasks (cached slices), or always route dynamically? Pre-compiled is faster but stale; dynamic is accurate but expensive.

## Next Steps

1. Build the Cartographer skill with full docs loaded
2. Build 2-3 domain execution skills to prove the handoff pattern
3. Wire interaction logging through MuninnDB
4. Adapt Mauricio's business skills for template context
5. Measure: does the two-layer approach actually outperform just dumping everything in context?
