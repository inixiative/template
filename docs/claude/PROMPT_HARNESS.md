# Prompt Refinement Harness

## Problem

When an AI agent implements a task in a codebase with established patterns (API routes, hooks, permissions, database schema, etc.), the output quality depends heavily on:

1. The **task prompt** — what you're asking it to do
2. The **system context** — CLAUDE.md, docs, conventions files

Today, refining these is a manual, vibes-based process. You tweak a doc, run a task, eyeball the output, repeat. There's no systematic way to know whether a change to your system prompt actually improved the agent's ability to follow your patterns.

## Proposal

Build a **test harness for prompt engineering** that treats prompt/system-prompt refinement like software testing: define inputs, define expected outputs, measure the delta, iterate.

## How It Works

### 1. Define a Fixture

A fixture is a self-contained test case:

```
fixtures/
  add-endpoint/
    prompt.md          # "Add a CRUD endpoint for Projects"
    subject-context.md # Domain knowledge for the Subject agent
    golden/            # The known-good implementation
      apps/api/src/routes/projects/...
      packages/db/prisma/schema.prisma (diff)
      apps/api/src/routes/projects/__tests__/...
    eval.config.ts     # Evaluation criteria (optional overrides)
    expected-questions.md  # Questions a good agent SHOULD ask
```

The **golden directory** contains the correct output — what a senior dev on your team would produce. This can be a full file tree or a set of diffs.

### 2. Run the Agents

For each fixture, three agents collaborate with **isolated contexts**:

```
Orchestrator
  │
  ├─→ Implementer: "Add a CRUD endpoint for Projects"
  │     │
  │     ├─→ [reads codebase, reads system docs]
  │     │
  │     ├─→ asks Subject: "Should deleting a project be a soft delete or hard delete?"
  │     │     │
  │     │     └─→ Subject: "Soft delete. Projects should be archived, not removed.
  │     │          We need to keep them for audit trails."
  │     │
  │     ├─→ asks Subject: "Can a project name be changed after creation?"
  │     │     │
  │     │     └─→ Subject: "Yes, but the name must remain unique within
  │     │          the organization."
  │     │
  │     ├─→ [implements the feature]
  │     │
  │     └─→ Done. Output captured.
  │
  ├─→ Oracle: "Grade this implementation"
  │     │
  │     ├─→ [diffs against golden]
  │     ├─→ [runs golden tests]
  │     ├─→ [checks pattern signatures]
  │     ├─→ [analyzes Q&A quality]
  │     │
  │     └─→ EvalResult { structural: 0.9, pattern: 0.85, semantic: 1.0, ... }
  │
  └─→ Results stored
```

### 3. Evaluate the Output

Compare agent output against the golden implementation:

| Tier | What's Checked | How |
|------|---------------|-----|
| **Structural** | Correct files created/modified, right directories | File tree diff |
| **Pattern** | Correct patterns used (route template, hook structure, test shape) | AST or regex matching against pattern signatures |
| **Semantic** | Logic is correct, handles edge cases | Test suite passes (run the golden tests against the agent's code) |
| **Stylistic** | Naming conventions, import style, code organization | Linter + custom rules |
| **Questioning** | Asked the right clarifying questions | Match against expected-questions |
| **Exact** | Character-level diff against golden | `git diff` — useful as a signal, not a hard gate |

Each tier produces a **score**. The composite score is what you optimize against.

### 4. Iterate on the Prompt / System Docs

This is the core loop:

```
while score < threshold:
    modify system_prompt or docs
    run all fixtures (parallel)
    compare scores to previous run
    keep changes that improve, revert those that regress
```

You're effectively doing **gradient descent on your documentation**, with fixtures as your training set and the eval scores as your loss function.

## Multi-Agent Architecture

The harness uses a **three-agent model** that mirrors how real development works — you don't implement in a vacuum, you ask questions and get feedback.

### The Three Agents

```
┌──────────────────────────────────────────────────────────┐
│                    Orchestrator                           │
│  Manages work trees, routes messages, collects results   │
│  Tools: Task (to spawn subagents), Read, Glob            │
└────────┬──────────────────┬──────────────────┬───────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌────────────────┐
│   Subject    │  │   Implementer    │  │     Oracle     │
│ (Domain      │  │ (Code Writer)    │  │ (Grader)       │
│  Expert)     │  │                  │  │                │
├──────────────┤  ├──────────────────┤  ├────────────────┤
│ Knows:       │  │ Knows:           │  │ Knows:         │
│ - Business   │  │ - System docs    │  │ - Golden impl  │
│   rules      │  │   (CLAUDE.md)    │  │ - Eval rubric  │
│ - Domain     │  │ - Codebase       │  │ - Pattern      │
│   context    │  │   (read access)  │  │   signatures   │
│ - Feature    │  │                  │  │                │
│   reqs       │  │ Can:             │  │ Can:           │
│              │  │ - Ask Subject    │  │ - Read agent   │
│ Cannot:      │  │   questions      │  │   output       │
│ - See code   │  │ - Read/write     │  │ - Run golden   │
│ - See golden │  │   code           │  │   tests        │
│   impl       │  │ - Run tests      │  │ - Diff against │
│              │  │                  │  │   golden       │
│ Cannot:      │  │ Cannot:          │  │                │
│ - Write code │  │ - See golden     │  │ Cannot:        │
│ - See eval   │  │   impl           │  │ - Modify code  │
│   criteria   │  │ - See eval       │  │ - Talk to      │
│              │  │   rubric         │  │   Implementer  │
└──────────────┘  └──────────────────┘  └────────────────┘
```

#### 1. Subject (Domain Expert)

The Subject simulates a **product owner or team lead** — someone who knows what the feature should do but doesn't dictate how to build it.

**Context provided:**
- Business requirements for the fixture (natural language description of the feature)
- Domain glossary (what terms mean in this project)
- Constraints and edge cases (what should and shouldn't be allowed)
- Answers to anticipated clarifying questions

**Context withheld:**
- The golden implementation (doesn't know the "right" code)
- System docs / CLAUDE.md (doesn't coach on patterns)
- Evaluation criteria (doesn't know how grading works)

**Role during a run:**
- Responds to Implementer's clarifying questions
- Stays in-character as a domain expert, not a developer
- Gives business-level answers, not implementation guidance

```ts
// Subject agent definition
const subject: AgentConfig = {
  model: "sonnet",       // Good reasoning, cost-effective for Q&A
  systemPrompt: `You are a domain expert for this project. You know the business
    requirements deeply but you are NOT a developer. Answer questions about WHAT
    the feature should do, never HOW to implement it. Stay in character.`,
  context: fixture.subjectContext,   // Business reqs, domain knowledge
  tools: [],                         // No tools — pure conversation
};
```

#### 2. Implementer (Code Writer)

The Implementer is the **agent under test** — the one whose output we're evaluating. This is the agent whose performance improves when your docs improve.

**Context provided:**
- System docs variant being tested (CLAUDE.md + docs/claude/*.md)
- The task prompt (from the fixture)
- Read access to the codebase (the clean work tree)
- Ability to ask Subject questions via the orchestrator

**Context withheld:**
- The golden implementation
- The evaluation rubric / pattern signatures
- Direct access to Subject's full context

**Role during a run:**
- Reads the codebase to understand existing patterns
- Asks the Subject clarifying questions when requirements are ambiguous
- Implements the feature end-to-end
- Runs its own tests if it writes them

```ts
// Implementer agent definition
const implementer: AgentConfig = {
  model: "opus",          // Most capable — this is the agent being tested
  systemPrompt: systemVariant.claudeMd,  // The docs being evaluated
  context: fixture.prompt,               // The task description
  tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task"],
  subagents: {
    "ask-subject": {
      description: "Ask the domain expert a clarifying question about requirements",
      // Routes to the Subject agent via orchestrator
    }
  }
};
```

#### 3. Oracle (Grader)

The Oracle runs **after** the Implementer finishes. It never interacts with the Implementer — complete information isolation. It's the referee, not a participant.

**Context provided:**
- The golden implementation (full file tree + diffs)
- Pattern signatures for this fixture
- Evaluation rubric and scoring weights
- The Implementer's output (captured file changes)
- The conversation log (what questions were asked, what answers were given)

**Context withheld:**
- Nothing — the Oracle sees everything except it cannot modify the output

**Role during a run:**
- Compares Implementer output against golden implementation
- Runs golden tests against Implementer's code
- Checks pattern signature matches
- Scores each evaluation tier
- Analyzes the Q&A log for question quality

```ts
// Oracle agent definition
const oracle: AgentConfig = {
  model: "sonnet",        // Strong analytical reasoning
  systemPrompt: `You are an expert code reviewer and evaluator. Compare the
    implementation against the golden reference. Be precise and objective.
    Score each dimension independently.`,
  context: {
    golden: fixture.goldenImpl,
    patterns: fixture.patternSignatures,
    rubric: fixture.evalConfig,
    agentOutput: capturedChanges,
    qaLog: conversationLog,
  },
  tools: ["Read", "Grep", "Glob", "Bash"],  // Read + run tests, no writing
};
```

### The Conversation Loop

The critical innovation: the Implementer can **ask questions** during implementation, and the Subject answers them. This creates a realistic development simulation.

### What the Q&A Log Tells You

The conversation between Implementer and Subject is itself a rich evaluation signal:

| Signal | What It Means |
|--------|--------------|
| **No questions asked** | Either the docs + prompt were perfectly clear, or the agent didn't know it was confused |
| **Good questions asked** | The agent identified genuine ambiguities — the docs need to address these |
| **Wrong questions asked** | The agent misunderstood something — a doc is misleading |
| **Questions the Subject couldn't answer** | The fixture's subject context is incomplete |
| **Questions that changed the outcome** | These are the critical decision points your docs should cover |

Track Q&A patterns across runs. If the Implementer consistently asks the same question across fixtures, that's a **systemic gap** in your documentation.

The `expected-questions.md` is a bonus evaluator — you can score whether the Implementer asked the right clarifying questions. An agent that blindly implements without asking about ambiguities might produce working code that makes wrong assumptions.

## Project Architecture

```
prompt-harness/
  fixtures/                    # Test cases
    add-endpoint/
      prompt.md                # Task for Implementer
      subject-context.md       # Domain knowledge for Subject
      golden/                  # Known-good implementation
      eval.config.ts           # Scoring weights, pattern signatures
      expected-questions.md    # Questions agent should ask
    add-batch-operation/
    add-background-job/
    schema-change-with-hooks/
  system-variants/             # Different versions of system context
    baseline/                  # Current CLAUDE.md + docs
    v2/                        # Experimental changes
  runner/
    orchestrator.ts            # Manages work trees + agent lifecycle
    subject.ts                 # Subject agent configuration
    implementer.ts             # Implementer agent configuration
    oracle.ts                  # Oracle agent configuration
    evaluate.ts                # Compares output to golden
    report.ts                  # Generates comparison reports
  results/                     # Timestamped run outputs
    2026-02-11T10-30-00/
      add-endpoint/
        output/                # What the agent produced
        eval.json              # Scores
        qa-log.json            # Full Q&A conversation
        diff.patch             # Delta from golden
```

### Runner Modes

**Serial** — Run fixtures one at a time. Cheaper. Good for initial development.

**Parallel** — Run all fixtures concurrently in separate work trees. Use for full evaluation runs after a prompt change. Each work tree is independent so there's no cross-contamination.

**A/B** — Run the same fixture with two different system-prompt variants simultaneously. Directly compare which version produces better output for the same task.

### Work Tree Lifecycle

```
1. git worktree add /tmp/harness-run-{id} {base-commit}
2. Copy system-variant docs into the work tree
3. Spawn Subject agent with fixture's domain context
4. Spawn Implementer agent with system docs + fixture prompt
5. Route Implementer ↔ Subject Q&A through orchestrator
6. Capture changed files when Implementer finishes
7. Spawn Oracle agent with golden + agent output + Q&A log
8. Store results
9. git worktree remove /tmp/harness-run-{id}
```

## Evaluation Detail

### The Golden Test Strategy

The most powerful evaluator: **run the golden implementation's tests against the agent's code.**

If you wrote tests as part of your golden implementation (which you should — it's a real implementation), those tests encode the correct behavior. Run them against the agent's output. Pass rate is an objective, meaningful metric.

### Pattern Signature Matching

Define regex or AST patterns that represent "correctly using our patterns":

```ts
// Example: verify the agent used the route template correctly
const routePatternSignatures = [
  /createRouteConfig\(\{/,           // Used route config factory
  /schema:\s*\{.*params:.*body:/s,   // Defined schemas properly
  /handler:\s*async\s*\(c\)/,        // Handler signature matches convention
  /getAppEnv\(c\)/,                  // Pulled context correctly
];
```

Count how many pattern signatures are present. This catches cases where code works but doesn't follow your conventions.

### Scoring Model

```ts
interface EvalResult {
  fixture: string;
  scores: {
    structural: number;     // 0-1: correct files in correct places
    pattern: number;        // 0-1: pattern signatures matched
    semantic: number;       // 0-1: golden tests pass rate
    stylistic: number;      // 0-1: linting + naming conventions
    questioning: number;    // 0-1: asked the right clarifying questions
  };
  composite: number;        // Weighted average
  diff: string;             // Patch from golden
  qaLog: QAEntry[];         // Full conversation log
  notes: string[];          // Specific observations
}

interface QAEntry {
  question: string;         // What the Implementer asked
  answer: string;           // What the Subject responded
  wasExpected: boolean;     // Matched an expected-question
  impactedOutput: boolean;  // Did the answer change the implementation
}
```

## Implementation with Claude Agent SDK

The harness orchestrator uses the Claude Agent SDK's subagent system. Each agent is a subagent with isolated context, spawned by the orchestrator via the `Task` tool.

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

// The orchestrator coordinates the three agents
async function runFixture(fixture: Fixture, systemVariant: SystemVariant) {
  const workTree = await createWorkTree(fixture.baseCommit);

  // Phase 1: Implementer works (can ask Subject questions)
  const implResult = await query({
    prompt: `
      Implement the following task in ${workTree.path}:
      ${fixture.prompt}

      When you have questions about requirements, use the "ask-subject" agent.
      Do NOT guess when requirements are ambiguous — ask.
    `,
    options: {
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task"],
      agents: {
        "ask-subject": {
          description: "Ask the domain expert a clarifying question about feature requirements",
          prompt: `You are a domain expert. Answer questions about what the feature
            should do based on this context:\n\n${fixture.subjectContext}`,
          tools: [],
          model: "sonnet"
        }
      },
      systemPrompt: systemVariant.docs,
      model: "opus"
    }
  });

  // Capture output
  const changes = await captureChanges(workTree);
  const qaLog = extractQALog(implResult);

  // Phase 2: Oracle grades (no interaction with Implementer)
  const evalResult = await query({
    prompt: `
      Evaluate this implementation against the golden reference.

      Golden implementation: ${JSON.stringify(fixture.golden)}
      Agent output: ${JSON.stringify(changes)}
      Q&A log: ${JSON.stringify(qaLog)}
      Pattern signatures: ${JSON.stringify(fixture.patternSignatures)}

      Run the golden tests against the agent's code.
      Score each dimension 0-1 and provide specific observations.
    `,
    options: {
      allowedTools: ["Read", "Grep", "Glob", "Bash"],
      model: "sonnet"
    }
  });

  await cleanupWorkTree(workTree);

  return {
    fixture: fixture.name,
    scores: evalResult.scores,
    qaLog,
    diff: changes.diff,
  };
}
```

### HIVEMIND Integration

For more complex multi-agent orchestration patterns beyond what the Claude Agent SDK provides natively, a HIVEMIND-style system can add:

- **Persistent agent identities** — agents maintain state across multiple fixture runs, building up "experience" with the codebase
- **Shared memory / message bus** — agents communicate through a structured channel rather than only through the orchestrator
- **Agent-to-agent protocols** — formalized question/answer formats, confidence signals, escalation paths
- **Swarm evaluation** — multiple Implementer agents tackle the same fixture independently, Oracle grades all of them, best patterns are identified

The HIVEMIND approach is especially valuable for Phase 4 (Self-Improving Loop) where agents could collaboratively analyze evaluation results and propose documentation improvements.

## Fixture Design Principles

### Coverage

Each fixture should exercise a different combination of patterns:

| Fixture | Patterns Exercised |
|---------|-------------------|
| `add-endpoint` | API route, controller, schema, basic test |
| `add-batch-operation` | Batch API, interpolation, transactions |
| `schema-change-with-hooks` | Prisma schema, hooks, cache invalidation |
| `add-background-job` | BullMQ job, cron, worker registration |
| `add-permissions` | Permix roles, entitlements, middleware |
| `full-feature` | All of the above combined |

### Golden Implementation Quality

The golden implementation must be:

- **Actually merged code** from your team, not hypothetical
- **Minimal** — only the changes needed, no extras
- **Well-tested** — the test suite is the backbone of evaluation
- **Representative** — uses your current patterns, not legacy approaches

### Prompt Realism

Fixture prompts should be realistic — the kind of thing you'd actually tell an agent:

```markdown
# Good
Add a CRUD endpoint for Projects. Projects belong to an Organization
and have a name (string, required) and status (enum: active, archived).
Include list, get, create, update, and delete operations.

# Bad (too specific — defeats the purpose)
Create file apps/api/src/routes/projects/index.ts using createRouteConfig
with GET /, GET /:id, POST /, PATCH /:id, DELETE /:id...
```

The whole point is to test whether the system docs are sufficient for the agent to figure out the *how*.

## What This Tells You

### About Your Docs

- If agents consistently miss a pattern, that pattern is **under-documented**
- If agents use the wrong pattern, there's **ambiguity** in the docs
- If agents get it right with extra doc text but not without, you've found the **minimum viable documentation** for that pattern

### About Your Patterns

- If the golden implementation is hard to describe in docs, the pattern might be **too complex**
- If agents produce simpler code that passes all tests, your pattern might be **over-engineered**
- If small prompt tweaks cause big output swings, your patterns have **too many decision points**

### About Your Prompts

- Quantifies how much **context** the agent actually needs
- Identifies which **terminology** the agent maps correctly to your codebase
- Shows where **examples** in docs provide more value than **descriptions**

## Implementation Phases

### Phase 1: Manual Baseline

- Create 2-3 fixtures by hand from recently merged PRs
- Write a simple runner (shell script + git worktrees)
- Evaluate by hand with a checklist
- Establish baseline scores for current docs

### Phase 2: Automated Evaluation

- Build the eval framework (test runner, pattern matching, scoring)
- Add 5-8 fixtures covering major pattern categories
- Automate the full run-evaluate-report cycle
- Generate comparison reports between runs

### Phase 3: Multi-Agent + A/B Testing

- Implement the three-agent model (Subject, Implementer, Oracle)
- Parallel work tree management
- Side-by-side system prompt variant comparison
- Q&A log analysis and question quality scoring
- Score tracking over time (are docs getting better?)
- CI integration — run on doc changes to catch regressions

### Phase 4: Self-Improving Loop (HIVEMIND)

- Use agent output analysis to **suggest** doc improvements
- Auto-generate fixture candidates from new PRs
- Track prompt effectiveness scores as a team metric
- Persistent agent identities across runs
- Swarm evaluation — multiple Implementers, best patterns identified

## Open Questions

1. **Cost** — Each fixture run is a full agent session (now with multi-agent overhead). At scale this gets expensive. Batch API or cheaper models for initial screening?
2. **Determinism** — Same prompt can produce different output. How many runs per fixture to get statistical significance? 3 minimum, 5 ideal?
3. **Fixture Freshness** — Patterns evolve. How to keep golden implementations in sync? Tag them to schema versions?
4. **Partial Credit** — An implementation that works but uses different patterns is... correct? wrong? The scoring weights encode your opinion here.
5. **Multi-Model** — Different models (Opus, Sonnet, Haiku) will score differently as Implementer. Track per-model or optimize for one?
6. **Subject Fidelity** — How realistic is a simulated domain expert? Should the Subject be seeded from actual Slack/issue conversations?
7. **Question Scoring** — How to weight "asked good questions" vs "produced good code"? An agent that asks nothing but gets it right is arguably better than one that asks great questions but still misses patterns.
8. **HIVEMIND Scope** — Where does the orchestrator end and HIVEMIND begin? Use SDK subagents for the core loop, HIVEMIND for cross-run intelligence?
