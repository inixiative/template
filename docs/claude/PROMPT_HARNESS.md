# Prompt Refinement Harness

> **Status: CONCEPTS ONLY — no implementation decisions have been made.**
>
> Everything below is a concept that was discussed and agreed on. Nothing below
> is a spec. There are no interfaces, no data formats, no API shapes. Those
> decisions haven't happened yet.

## Problem

When an AI agent implements a task in a codebase with established patterns, the output quality depends on:

1. The **task prompt** — what you're asking it to do
2. The **system context** — CLAUDE.md, docs, conventions files

Today, refining these is manual and vibes-based. You tweak a doc, run a task, eyeball the output, repeat. There's no systematic way to know whether a change to your system prompt actually improved the agent's ability to follow your patterns.

## Proposal

Build a test harness for prompt engineering that treats prompt/system-prompt refinement like software testing: define inputs, define expected outputs, measure the delta, iterate.

## Decided Concepts

### Fixtures

A fixture is a self-contained test case. Each fixture has:

- **A terse prompt** — one or two sentences, like what a PM would type in Slack. "We need a projects endpoint." That's it. The prompt is deliberately incomplete — the agent has to figure out what's missing.
- **Gated domain knowledge** — the answers to the questions the agent *should* ask, structured so they're only revealed when the right question is asked.
- **A golden implementation** — the known-good output. What a senior dev on the team would produce. Extracted from real merged PRs, not hypothetical.
- **An assertion checklist** — concrete, mechanically-checkable rules. "Did it use the factory?" "Are types inferred?" "Did it set up dependencies correctly?"
- **Expected questions** — the questions a competent agent should ask before implementing.

### Three Agents

Each fixture run involves three agents with isolated contexts:

**Subject (The Vague PM).** Simulates a stereotypical project manager who knows the requirements but doesn't think to include detail. Not hostile, not withholding — genuinely believes "we need a projects endpoint" is a complete requirement. Answers happily when asked the right question. Confused by technical/implementation questions ("I don't know what a factory pattern is, build it however you normally do"). Has strong opinions on business rules but expresses them reactively, not proactively.

The Subject's knowledge is gated. It only reveals an answer when the Implementer asks a question that semantically matches. If the Implementer never asks about permissions, the Subject never mentions them — even though it knows "only admins can create."

**Implementer (Code Writer).** The agent under test. Gets the terse prompt, has access to the codebase and system docs, and can ask the Subject clarifying questions. Implements the feature end-to-end. The Implementer does NOT see the golden implementation, the assertion checklist, or the scoring rubric.

**Oracle (Grader).** Runs after the Implementer finishes. Never interacts with the Implementer. Compares the output against the golden, runs the golden tests against the agent's code, checks assertions, analyzes the Q&A log. Produces a score and a diagnosis.

### Five Scoring Rubrics

Each measures something fundamentally different:

**1. Prompt Efficiency (meta — scores the docs, not the agent).** How much system prompt did it take to get this result? Quality of output divided by tokens in the system prompt. Creates pressure to make docs concise and modular — a doc variant that produces the same quality with fewer tokens scores higher.

**2. Completion (positive — how far did the agent get?).** How much of the task did the agent complete correctly before self-terminating? Measured as correctly-completed subtasks over total subtasks in the golden. The agent is NOT forced to finish — it decides when it's done, and that decision is part of the signal.

**3. Demerits (negative — driving test style).** Binary violations of specific rules. Each demerit is a concrete, checkable mistake. Major demerits (wrong pattern, security issue, broke tests) and minor demerits (naming violation, unnecessary import). Demerits are subtractive from the composite score, not a separate dimension.

**4. Craft (qualitative — would a senior dev approve this PR?).** How stylistically similar is the output to the golden? Not character-identical but "would this pass code review?" Measures verbosity, file placement, pattern reuse, naming, scope discipline, and over-engineering.

**5. Questioning (diagnostic — did the agent extract what it needed?).** Did the agent ask the right questions of the Subject? Scored against the expected-questions list. Penalizes missed core questions, wasteful questions (asking the PM about code patterns), and rewards useful questions not on the expected list. This is the strongest diagnostic signal because it directly reveals what the agent knew it didn't know.

### Self-Termination

The agent decides when it's done. It's not forced to finish. Where it stops is the measurement point. An agent that says "I implemented the endpoint but I'm not sure about the permission model so I left a TODO" gets credit for knowing where it was uncertain, rather than being penalized for incompleteness.

### Complexity Tiers

Fixtures are organized by complexity, and **correct behavior changes by tier**:

- **Simple** — Complete everything. Follow all patterns. Ask few questions.
- **Medium** — Complete the core. Ask clarifying questions about ambiguous requirements. May defer edge cases.
- **Complex** — Build the skeleton. Ask lots of questions. Explicitly flag what needs human review. Stopping with a clean partial plus clear TODOs scores *better on craft* than pushing through and getting things wrong.

Restraint at higher tiers is positively scored. A doc change that makes the agent nail simple tasks but overreach on complex ones is a regression.

### The Refinement Loop

The Oracle doesn't just score — it diagnoses, prescribes, and re-triggers:

1. **Implement** — Implementer + Subject run the fixture
2. **Evaluate** — Oracle scores against golden
3. **Diagnose** — Oracle compares to previous runs (step forward / step back / plateau)
4. **Prescribe** — Oracle proposes a specific doc/prompt change
5. **Decide** — Step back means revert; step forward means keep going; plateau means try something different
6. **Re-trigger** — Apply the patch, run again

The loop stops on convergence (score exceeds threshold across N runs), budget exhaustion, plateau detection, or human escalation.

### Parallel Execution

Every doc change is tested against ALL fixtures simultaneously. No change gets applied until we know its impact across every tier. When results are mixed (improved simple but regressed complex), the Oracle decomposes the patch into independent signals and extracts only the positive parts.

### Three Branches Per Fixture

Each fixture has three git branches:

- **Raw** — What the Implementer sees. Clean codebase. No harness metadata anywhere. System docs are injected by the orchestrator.
- **Subject** — What the Subject reads. Same codebase plus `.harness/` with domain knowledge and the task prompt.
- **After** — What the Oracle reads. The codebase with the golden implementation applied, plus assertions and eval config.

Each agent sees exactly one branch. No scoping, no stripping, no "ignore this directory" instructions. The Implementer can't accidentally read the answers because they're on a different branch.

### Fixture Authoring

Creating a fixture is one interview that produces two outputs:

1. You sit down. An agent plays the Implementer role and asks you questions about a feature you recently built.
2. The conversation produces both **subject-context** (the Q&A pairs become the Subject's gated knowledge) and **expected-questions** (the questions the agent asked become the checklist of questions a good Implementer should ask during eval).
3. You review — add anything the agent didn't think to ask, remove any implementation details that leaked in.

### Fixture Rotation

Fixtures have a TTL (varies by tier). When they expire, replace them with fresh extractions from recent PRs. Don't rebase — one bad conflict resolution and the raw branch has after-branch content baked in. Fresh extraction means the fixture is born current, and the assertions reflect the real patterns.

### Decision Point Taxonomy

When agents implement features, there are specific categories of decisions they tend to fill in silently rather than asking. These are the categories the expected-questions should cover:

| Category | What Gets Hand-Waved | Example |
|----------|---------------------|---------|
| **Boundaries** | Who can access this? What's in scope? | Agent builds endpoint with no permissions check |
| **Data Model** | What fields? What types? Required vs optional? | Agent invents fields without asking |
| **Lifecycle** | What happens on create/update/delete? Side effects? | Agent hard-deletes when PM wanted soft delete |
| **Relationships** | How does this connect to other entities? | Agent creates standalone table with no foreign keys |
| **Business Rules** | Uniqueness? Validation? Constraints? | Agent allows duplicate names when PM expects uniqueness |
| **Error Cases** | What happens when things go wrong? | Agent returns 500 for everything |
| **Information Flow** | Who gets notified? What triggers what? | Agent skips notifications PM assumed were obvious |
| **Naming/Taxonomy** | What do we call things? What are the states? | Agent invents status enum instead of asking |

The signal to ask: **"I'm about to write something where a different choice would be equally valid."** If you're inventing domain details (field names, states, permissions, validation rules), stop and ask instead.

### Dogfooding

The harness tests itself. A `_self` fixture evaluates whether the harness's own docs are sufficient for an agent to understand and extend the harness. If the harness can't describe itself well enough for an agent to extend it, it has no business evaluating other docs.

## Open Questions

These need real answers before implementation starts. Each one is a decision that was either never discussed or was filled in speculatively.

### Architecture

1. **Where does this live?** Standalone package in the monorepo? Separate repo? How does it relate to the existing workspace structure?
2. **What coordinates the agents?** Claude Agent SDK subagents? Separate Claude sessions via HIVEMIND? Something else? The orchestration model drives everything.
3. **How do agents communicate?** The Implementer needs to ask the Subject questions during a run. What's the actual mechanism? MCP? Direct subagent routing? Event queue?

### Data & Storage

4. **What format is subject-context?** YAML with trigger keywords? Plain markdown? JSON? The doc had YAML with `reveal_on` arrays but that was invented without discussion.
5. **What format are run results?** JSON files? SQLite? The doc described file-per-run directories but that's speculative.
6. **What does the run ledger look like?** Append-only file? Database table? How much data per entry?
7. **What does a diagnosis contain?** The doc had detailed `Diagnosis` and `Prescription` interfaces with 20+ fields each. What's the actual minimum viable structure?

### Scoring

8. **What are the actual scoring weights?** The doc said completion: 0.40, craft: 0.20, questioning: 0.25. Are those right? Were they ever discussed?
9. **How are demerits weighted?** The doc said major: -0.15, minor: -0.05. Is that the right scale?
10. **How does prompt efficiency work as a multiplier?** The formula `baseline_tokens / actual_tokens` was assumed. What's the actual intent?
11. **How many runs for statistical significance?** Same prompt can produce different output. 3 runs? 5? Average? Median?

### Assertions

12. **How detailed should assertions be?** The doc had a full assertion DSL with types like `file_exists`, `file_contains`, `ast_match`, `custom`. Is that the right level? Or simpler?
13. **Who writes assertions — human or auto-generated?** The doc described auto-generation from PR diffs with human review. Is that the workflow?

### Infrastructure

14. **Local first or cloud first?** The doc described three deployment tiers. What's the MVP?
15. **HIVEMIND integration — is it required?** The doc assumed HIVEMIND for all coordination. Is that the plan or was it assumed?
16. **Container isolation — is it needed for MVP?** Or is git worktree with refspec restriction sufficient?

### Advanced Features

17. **Knowledge tree — is this in scope?** The doc described a three-level doc reorganization. Is that part of the harness or a separate project?
18. **Perturbation/simulated annealing — is this in scope?** The doc described a chaos injection system. MVP or future?
19. **Multi-model support — is this in scope?** Running same fixture on Opus/Sonnet/Haiku with different expectations.
20. **MCP server exposure — is this in scope?** Letting Claude call harness operations directly.

### Process

21. **What's the first fixture?** Which recently merged PR becomes the first test case?
22. **What's the implementation order?** The doc described four phases. Is that right?
23. **Who reviews Oracle prescriptions?** Fully autonomous or human-in-the-loop?

## Cautionary Tale: How This Doc Was Written

This document is itself a demonstration of the problem it describes.

During the design conversation, the process went like this:

1. **The user stated a concept** — "the Subject should be a vague PM"
2. **The agent (Claude) immediately wrote TypeScript** — `interface AgentConfig { model: "sonnet", systemPrompt: ...}` with a full system prompt, model selection, tool configuration, and routing setup
3. **The output looked like a spec** — 29 TypeScript code blocks, detailed interfaces for scoring, orchestration, diagnostics, storage, deployment
4. **Almost none of it was discussed** — the user decided on concepts (three agents, five rubrics, gated knowledge, decision taxonomy). The agent invented the rest: data formats, API shapes, scoring weights, file structures, deployment tiers, MCP tool lists, Docker configs, cost estimates

The TypeScript was the problem. It looked like precision. It read like decisions. A future reader seeing `interface EvalResult { completion: number; craft: number; ... }` would think the scoring model's fields had been designed and validated. They hadn't — the agent made them up on the spot because the interface needed fields.

Every single "speculative" item in the Open Questions section above was, in the previous version of this doc, presented as a decided TypeScript interface. The YAML format for subject-context? Invented. The `reveal_on` keyword matching? Invented. The `Diagnosis` interface with `completionAnalysis`, `demeritAnalysis`, `craftAnalysis`, `questionAnalysis`, and `promptAnalysis` sub-objects? All invented. The `PerturbationConfig` with annealing schedules? Invented. The `WatchdogConfig`? Invented.

In each case:
- The fill-in was plausible (that's the danger — it *looked* reasonable)
- A different choice would have been equally valid (the exact condition that should trigger asking)
- The user was never asked
- The output looked complete, discouraging further questioning

This is the exact behavior the harness is designed to measure and improve: **an agent filling in domain details instead of asking, producing output that looks right but encodes unvalidated decisions.**

The irony is not lost. The document about teaching agents to ask questions was itself written by an agent that didn't ask questions. The scoring rubric about "demerits for hand-waving" was hand-waved into existence. The decision point taxonomy — which correctly identifies "data model," "lifecycle," and "boundaries" as categories that get silently filled in — was demonstrated in real time by the agent silently filling in data models, lifecycles, and boundaries for every system described in the doc.

**The rule going forward: concepts in prose, not TypeScript. TypeScript is for validated specs, not design exploration. If you're writing an interface and you're choosing the field names yourself, you're not documenting a decision — you're making one.**
