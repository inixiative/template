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

### 4. The Refinement Loop

The Oracle doesn't just score — it **diagnoses, prescribes, and re-triggers**. This is the closed loop that makes the system self-improving.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RUN LEDGER (append-only)                      │
│                                                                  │
│  Run 1 ──→ Run 2 ──→ Run 3 ──→ Run 4 ──→ ...                  │
│  │          │          │          │                               │
│  prompt_v1  prompt_v2  prompt_v2  prompt_v3                      │
│  docs_v1    docs_v1    docs_v2    docs_v2                        │
│  score:0.6  score:0.7  score:0.65 score:0.82                    │
│  ▲ step     ▲ step     ▼ regress  ▲ step                        │
│  forward    forward    (revert)   forward                        │
└─────────────────────────────────────────────────────────────────┘
```

#### The Full Cycle

```
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  1. IMPLEMENT                                            │
  │     Implementer + Subject run fixture                    │
  │     Output: code changes + Q&A log                       │
  │                                                          │
  │  2. EVALUATE                                             │
  │     Oracle scores against golden                         │
  │     Output: EvalResult + RunReport                       │
  │                                                          │
  │  3. DIAGNOSE                                             │
  │     Oracle compares to previous runs in the ledger       │
  │     Output: step forward / step back / plateau           │
  │                                                          │
  │  4. PRESCRIBE (if not converged)                         │
  │     Oracle proposes specific doc/prompt changes           │
  │     Output: patch to system docs or fixture prompt       │
  │                                                          │
  │  5. DECIDE                                               │
  │     If step back → revert to previous docs, try again    │
  │     If step forward → keep changes, continue             │
  │     If plateau → try a different approach                │
  │                                                          │
  │  6. RE-TRIGGER                                           │
  │     Apply the patch, run the fixture again               │
  │     Loop back to step 1                                  │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

The Oracle is doing **gradient descent on your documentation** — the run ledger is the loss curve, the doc patches are the weight updates, and convergence means your docs are good enough.

#### Stopping Conditions

The loop stops when:
- **Convergence** — Score exceeds threshold across N consecutive runs
- **Budget** — Max iterations or cost ceiling reached
- **Plateau** — Score hasn't improved in K runs despite different approaches
- **Human review** — Oracle flags a case it can't resolve automatically

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
  system-variants/             # Versioned snapshots of system context
    baseline/                  # Current CLAUDE.md + docs (starting point)
    variant-001/               # Oracle's first patch
    variant-002/               # Oracle's second patch
    variant-003/               # ...auto-generated by the loop
    current-best/              # Symlink to highest-scoring variant
  runner/
    orchestrator.ts            # Manages work trees + agent lifecycle
    loop.ts                    # The closed refinement loop
    subject.ts                 # Subject agent configuration
    implementer.ts             # Implementer agent configuration
    oracle.ts                  # Oracle agent configuration + diagnosis
    evaluate.ts                # Compares output to golden
    report.ts                  # Generates human-readable reports
    ledger.ts                  # Run ledger CRUD operations
  results/                     # Per-fixture run history
    add-endpoint/
      ledger.json              # Full run history for this fixture
      runs/
        run-001/
          output/              # What the agent produced
          eval.json            # Scores
          qa-log.json          # Full Q&A conversation
          diff.patch           # Delta from golden
          report.md            # Human-readable Oracle report
          diagnosis.json       # Structured diagnosis
          prescription.json    # Proposed doc patch
        run-002/
          ...
    add-batch-operation/
      ledger.json
      runs/
        ...
  cross-fixture/               # Cross-fixture analysis
    epoch-001/
      scores.json              # All fixture scores for this docs version
      analysis.md              # Cross-fixture patterns
      prescription.json        # Unified doc patch
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

### The Run Ledger

Every run is recorded in an append-only ledger. The Oracle reads this to understand trajectory — not just "how did this run go" but "are we getting better."

```ts
interface RunLedger {
  fixture: string;
  runs: RunEntry[];
}

interface RunEntry {
  id: string;                    // Unique run ID
  timestamp: string;             // ISO timestamp
  systemVariant: string;         // Which docs version was used
  promptVersion: string;         // Which fixture prompt version
  scores: EvalResult["scores"];  // The scores from this run
  composite: number;
  qaLog: QAEntry[];              // What was asked and answered
  diagnosis: Diagnosis;          // Oracle's analysis
  prescription: Prescription | null;  // What the Oracle wants to change
  status: "step_forward" | "step_back" | "plateau" | "converged";
}

interface Diagnosis {
  comparedTo: string;            // Run ID this was compared against
  delta: number;                 // Composite score change (+/-)
  regressions: string[];         // What got worse
  improvements: string[];        // What got better
  rootCause: string;             // Oracle's analysis of WHY
  patterns: {
    missed: string[];            // Pattern signatures agent didn't follow
    wrong: string[];             // Patterns used incorrectly
    extra: string[];             // Patterns agent added that aren't in golden
  };
  questionAnalysis: {
    shouldHaveAsked: string[];   // Expected questions that weren't asked
    goodQuestions: string[];     // Questions that led to better output
    wastefulQuestions: string[]; // Questions that didn't help
  };
}

interface Prescription {
  type: "doc_patch" | "prompt_patch" | "fixture_update" | "escalate";
  target: string;               // Which file to modify
  reason: string;               // Why this change should help
  patch: string;                // The actual diff to apply
  confidence: number;           // 0-1: how confident the Oracle is
  expectedImpact: string;       // What the Oracle thinks will change
}
```

### The Oracle Report

After each run, the Oracle produces a structured report that becomes the input to the next cycle.

```
results/
  add-endpoint/
    ledger.json                  # Full run history
    runs/
      run-001/
        output/                  # What the agent produced
        eval.json                # Scores
        qa-log.json              # Full Q&A conversation
        diff.patch               # Delta from golden
        report.md                # Human-readable Oracle report
      run-002/
        ...
    current-best/                # Snapshot of highest-scoring docs version
      CLAUDE.md
      docs/claude/*.md
```

Example Oracle report:

```markdown
# Run Report: add-endpoint / run-003

## Scores
| Dimension    | This Run | Previous | Delta |
|-------------|----------|----------|-------|
| Structural  | 0.90     | 0.85     | +0.05 |
| Pattern     | 0.70     | 0.80     | -0.10 |
| Semantic    | 1.00     | 0.90     | +0.10 |
| Stylistic   | 0.85     | 0.85     |  0.00 |
| Questioning | 0.60     | 0.40     | +0.20 |
| **Composite** | **0.82** | **0.78** | **+0.04** |

## Status: STEP FORWARD

## Diagnosis
The doc change to API_ROUTES.md (adding the schema example) improved structural
accuracy — the agent now creates files in the right directories. Semantic score
jumped because the agent asked the Subject about soft delete (it didn't before)
and implemented it correctly.

However, pattern score regressed. The agent stopped using `createRouteConfig`
and wrote raw Hono routes instead. Root cause: the new example in API_ROUTES.md
shows a simplified pattern that doesn't use the factory function.

## Q&A Analysis
- GOOD: Asked "Should delete be soft or hard?" (expected, impacted output)
- GOOD: Asked "Is project name unique per org?" (expected, impacted output)
- MISSING: Did not ask about authorization requirements (expected)
- WASTEFUL: Asked "What HTTP status for not found?" (answered by system docs)

## Prescription
**Type:** doc_patch
**Target:** docs/claude/API_ROUTES.md
**Confidence:** 0.75

The example added in the previous iteration should use `createRouteConfig`
instead of raw Hono routes. The simplified example is misleading the agent
into thinking the factory is optional.

\`\`\`diff
- // Example: basic route
- app.get("/projects", async (c) => {
+ // Example: route using the factory (ALWAYS use createRouteConfig)
+ const routes = createRouteConfig({
+   schema: { params: z.object({ id: z.string() }) },
+   handler: async (c) => {
\`\`\`

## Next Action
Apply patch → re-run fixture → compare against this run.
```

## Implementation with Claude Agent SDK

The harness orchestrator uses the Claude Agent SDK's subagent system. Each agent is a subagent with isolated context, spawned by the orchestrator via the `Task` tool.

### Single Run

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

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

  return { fixture: fixture.name, scores: evalResult.scores, qaLog, diff: changes.diff };
}
```

### The Closed Loop

This is the core of the system. The Oracle doesn't just grade — it reads the full run history, diagnoses what went wrong, proposes a fix, and triggers the next run.

```ts
async function refinementLoop(
  fixture: Fixture,
  initialVariant: SystemVariant,
  options: { maxRuns: number; targetScore: number; costCeiling: number }
) {
  const ledger: RunLedger = await loadOrCreateLedger(fixture.name);
  let currentVariant = initialVariant;
  let totalCost = 0;

  for (let i = 0; i < options.maxRuns; i++) {
    // --- 1. IMPLEMENT + EVALUATE ---
    const runResult = await runFixture(fixture, currentVariant);
    totalCost += runResult.cost;

    // --- 2. DIAGNOSE + PRESCRIBE ---
    // Oracle gets the FULL ledger — every previous run, every score, every Q&A log
    const oracleAnalysis = await query({
      prompt: `
        You are the Oracle. Analyze this run in context of the full history.

        CURRENT RUN:
        ${JSON.stringify(runResult)}

        FULL RUN HISTORY (oldest first):
        ${JSON.stringify(ledger.runs)}

        GOLDEN IMPLEMENTATION:
        ${JSON.stringify(fixture.golden)}

        CURRENT SYSTEM DOCS:
        ${currentVariant.docs}

        Your job:
        1. DIAGNOSE: Compare this run to the previous best. What improved? What regressed? WHY?
        2. PRESCRIBE: Propose a SPECIFIC patch to the system docs or fixture prompt that
           would fix the biggest regression or amplify the biggest improvement.
           Output the patch as a unified diff.
        3. DECIDE: Is this a step forward, step back, or plateau?
           - step_forward: keep the current docs, apply your new patch
           - step_back: revert to the previous best docs, try a DIFFERENT patch
           - plateau: the current approach isn't working, try something fundamentally different
           - converged: score is good enough, stop

        Return structured JSON matching the Diagnosis and Prescription interfaces.
      `,
      options: {
        allowedTools: ["Read", "Grep", "Glob"],
        model: "sonnet"
      }
    });

    // --- 3. RECORD ---
    const runEntry: RunEntry = {
      id: `run-${String(ledger.runs.length + 1).padStart(3, "0")}`,
      timestamp: new Date().toISOString(),
      systemVariant: currentVariant.id,
      promptVersion: fixture.promptVersion,
      scores: runResult.scores,
      composite: runResult.composite,
      qaLog: runResult.qaLog,
      diagnosis: oracleAnalysis.diagnosis,
      prescription: oracleAnalysis.prescription,
      status: oracleAnalysis.status,
    };
    ledger.runs.push(runEntry);
    await saveLedger(ledger);
    await saveRunArtifacts(runEntry, runResult);

    // --- 4. STOPPING CONDITIONS ---
    if (oracleAnalysis.status === "converged") {
      console.log(`Converged at run ${runEntry.id} with score ${runResult.composite}`);
      break;
    }
    if (totalCost >= options.costCeiling) {
      console.log(`Cost ceiling reached: $${totalCost}`);
      break;
    }
    if (isPlateau(ledger, 3)) {
      console.log(`Plateau detected — 3 runs without improvement`);
      break;
    }

    // --- 5. APPLY PRESCRIPTION + RE-TRIGGER ---
    if (oracleAnalysis.status === "step_back") {
      // Revert to the best-scoring variant
      currentVariant = await loadVariant(getBestRun(ledger).systemVariant);
    }

    if (oracleAnalysis.prescription) {
      // Apply the Oracle's proposed patch to the docs
      currentVariant = await applyPatch(currentVariant, oracleAnalysis.prescription);
      await saveVariant(currentVariant); // Snapshot for reproducibility
    }

    // Loop continues — next iteration runs with the patched docs
  }

  return {
    ledger,
    bestRun: getBestRun(ledger),
    bestVariant: await loadVariant(getBestRun(ledger).systemVariant),
  };
}
```

### Cross-Fixture Refinement

A single fixture loop optimizes docs for one task. But doc changes that help one fixture might hurt another. The top-level orchestrator runs all fixtures and detects cross-fixture regressions.

```ts
async function fullRefinementSuite(fixtures: Fixture[], initialVariant: SystemVariant) {
  let currentVariant = initialVariant;

  for (let epoch = 0; epoch < MAX_EPOCHS; epoch++) {
    // Run all fixtures in parallel with current docs
    const results = await Promise.all(
      fixtures.map(f => runFixture(f, currentVariant))
    );

    // Oracle analyzes cross-fixture patterns
    const crossAnalysis = await query({
      prompt: `
        Analyze results across ALL fixtures for this docs version.

        ${JSON.stringify(results)}

        Look for:
        - Patterns that EVERY fixture missed → systemic doc gap
        - Questions EVERY implementer asked → undocumented decision point
        - Fixtures that regressed when others improved → doc conflict
        - The single highest-leverage doc change that would help the most fixtures

        Propose ONE patch that maximizes improvement across all fixtures.
      `,
      options: { model: "sonnet" }
    });

    // Apply, record, check convergence — same pattern as single-fixture loop
    currentVariant = await applyPatch(currentVariant, crossAnalysis.prescription);

    if (crossAnalysis.allConverged) break;
  }
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

### Complexity Tiers

Fixtures are organized by complexity. Each tier has different expectations for what "correct" looks like — and critically, **restraint at higher tiers is scored positively**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FIXTURE COMPLEXITY TIERS                         │
├──────────┬────────────────────────────┬────────────────────────────┤
│  Tier    │  What's Expected           │  Correct Restraint         │
├──────────┼────────────────────────────┼────────────────────────────┤
│          │  Complete implementation   │  N/A — should finish       │
│  SIMPLE  │  All files, all tests      │  everything                │
│          │  Full pattern compliance   │                            │
├──────────┼────────────────────────────┼────────────────────────────┤
│          │  Core implementation done  │  May defer edge cases      │
│  MEDIUM  │  Main patterns followed    │  Should ask Subject about  │
│          │  Tests for happy path      │  ambiguous requirements    │
├──────────┼────────────────────────────┼────────────────────────────┤
│          │  Skeleton / scaffolding    │  SHOULD stop early and     │
│  COMPLEX │  Key architectural choices │  flag what needs human     │
│          │  Partial implementation OK │  review rather than guess  │
└──────────┴────────────────────────────┴────────────────────────────┘
```

#### Why Restraint Matters

A doc change that makes the agent nail simple tasks but overreach on complex ones is a **regression**. The ideal agent behavior scales with complexity:

- **Simple fixture**: Implement everything. Ask few questions. Get it right.
- **Medium fixture**: Implement the core. Ask clarifying questions. Handle the main patterns.
- **Complex fixture**: Build the skeleton. Ask lots of questions. Explicitly flag what it can't confidently implement. Leave TODO markers with clear descriptions rather than writing wrong code.

```ts
interface FixtureConfig {
  name: string;
  tier: "simple" | "medium" | "complex";
  prompt: string;
  subjectContext: string;
  golden: GoldenImpl;
  evalConfig: {
    // Tier-specific scoring weights
    weights: {
      structural: number;
      pattern: number;
      semantic: number;
      stylistic: number;
      questioning: number;
      restraint: number;      // NEW: penalizes overreach, rewards knowing limits
    };
    // What counts as "done" at this tier
    completionExpectation: "full" | "core" | "skeleton";
    // Patterns the agent SHOULD NOT attempt at this tier
    outOfScope: string[];
  };
}
```

#### Scoring Restraint

The `restraint` dimension measures whether the agent correctly judged its own confidence:

| Behavior | Simple | Medium | Complex |
|----------|--------|--------|---------|
| Implemented everything correctly | 1.0 | 1.0 | 0.7 (suspicious — did it get lucky or actually know?) |
| Implemented core, flagged rest as TODO | 0.5 | 0.9 | 1.0 |
| Built skeleton with clear decision points | 0.2 | 0.6 | 1.0 |
| Implemented everything but some is wrong | 0.0 | 0.3 | 0.0 (should have stopped) |
| Didn't attempt enough | 0.3 | 0.5 | 0.7 (at least it knew its limits) |

For complex fixtures, the golden implementation itself may be a **partial implementation** — a well-structured skeleton with clear TODO markers, decision points flagged, and a summary of what needs human input. The Oracle grades against *that*.

#### Fixture Matrix

Fixtures vary on two axes: **pattern** and **complexity**.

| | Simple | Medium | Complex |
|---|--------|--------|---------|
| **API Route** | Single CRUD endpoint | CRUD + custom actions + pagination | Multi-resource with relationships, auth, batch |
| **Schema Change** | Add a field | Add a model with relations | Schema migration with data backfill + hooks |
| **Background Job** | Simple cron | Job with retry logic | Multi-step pipeline with dependencies |
| **Permissions** | Add a role | Role + entitlements + middleware | Dynamic permissions with org hierarchy |
| **Full Feature** | — | — | End-to-end feature touching all layers |

The cross-product gives you fine-grained regression detection. If a doc change improves "API Route / Simple" but regresses "API Route / Complex," the Oracle knows the doc made simple patterns clearer but introduced ambiguity about when to apply them.

#### Partial Golden Implementations

For medium and complex tiers, the golden can have **stages**:

```
fixtures/
  api-route-complex/
    prompt.md
    subject-context.md
    golden/
      stage-1-skeleton/        # Correct scaffolding + TODOs
      stage-2-core/            # Main patterns implemented
      stage-3-complete/        # Full implementation (aspirational)
    eval.config.ts
```

The Oracle grades against the appropriate stage for the tier:
- **Simple** fixtures: grade against `stage-3-complete`
- **Medium** fixtures: grade against `stage-2-core`, bonus for reaching stage 3
- **Complex** fixtures: grade against `stage-1-skeleton`, bonus for reaching stage 2

This means a doc change can be evaluated at each complexity level independently. The Oracle's cross-tier analysis catches the critical regression: "this doc change moved the agent from correctly stopping at skeleton (score: 0.9) to overreaching with wrong code (score: 0.3)."

### Coverage

Each fixture should exercise a different combination of patterns:

| Fixture | Tier | Patterns Exercised |
|---------|------|-------------------|
| `add-endpoint-simple` | Simple | API route, controller, schema, basic test |
| `add-endpoint-medium` | Medium | API route + custom actions, pagination, filtering |
| `add-endpoint-complex` | Complex | Multi-resource, auth, batch, relationships |
| `schema-change-simple` | Simple | Add field to existing model |
| `schema-change-complex` | Complex | New model + hooks + cache invalidation + migration |
| `add-background-job` | Medium | BullMQ job, cron, worker registration |
| `add-permissions` | Medium | Permix roles, entitlements, middleware |
| `full-feature` | Complex | All of the above combined |

### Golden Implementation Quality

The golden implementation must be:

- **Actually merged code** from your team, not hypothetical
- **Minimal** — only the changes needed, no extras
- **Well-tested** — the test suite is the backbone of evaluation
- **Representative** — uses your current patterns, not legacy approaches
- **Staged** (for medium/complex) — separate skeleton, core, and complete versions

### Prompt Realism

Fixture prompts should be realistic — the kind of thing you'd actually tell an agent:

```markdown
# Good (simple)
Add a CRUD endpoint for Projects. Projects belong to an Organization
and have a name (string, required) and status (enum: active, archived).
Include list, get, create, update, and delete operations.

# Good (complex — intentionally ambiguous)
We need a full Projects feature. Projects belong to organizations, have
multiple members with different roles, support file attachments, and need
an approval workflow. Members should be notified when project status changes.

# Bad (too specific — defeats the purpose)
Create file apps/api/src/routes/projects/index.ts using createRouteConfig
with GET /, GET /:id, POST /, PATCH /:id, DELETE /:id...
```

For complex prompts, the ambiguity is intentional. The correct response involves asking the Subject clarifying questions AND recognizing what's out of scope for a single implementation pass.

## Cross-Tier Regression Detection

The most valuable signal from the complexity tiers: **doc changes should not cause regressions at any tier.**

```ts
interface CrossTierAnalysis {
  fixture: string;
  byTier: {
    simple: { before: number; after: number; delta: number };
    medium: { before: number; after: number; delta: number };
    complex: { before: number; after: number; delta: number };
  };
  overallDelta: number;
  regressions: TierRegression[];
}

interface TierRegression {
  tier: "simple" | "medium" | "complex";
  dimension: string;        // Which score dimension regressed
  before: number;
  after: number;
  rootCause: string;        // Oracle's analysis
  // The critical question: did a simplification cause overreach?
  overreachDetected: boolean;
}
```

The Oracle specifically looks for the **simplification trap**: a doc change that makes a pattern easier to understand (improving simple tier) can also make the agent think it fully understands a complex scenario when it doesn't (regressing complex tier).

## What This Tells You

### About Your Docs

- If agents consistently miss a pattern, that pattern is **under-documented**
- If agents use the wrong pattern, there's **ambiguity** in the docs
- If agents get it right with extra doc text but not without, you've found the **minimum viable documentation** for that pattern
- If simple scores improve but complex scores regress, docs are **too prescriptive** — they make easy things easy but remove the agent's ability to recognize uncertainty

### About Your Patterns

- If the golden implementation is hard to describe in docs, the pattern might be **too complex**
- If agents produce simpler code that passes all tests, your pattern might be **over-engineered**
- If small prompt tweaks cause big output swings, your patterns have **too many decision points**

### About Agent Judgment

- If agents overreach on complex tasks, your docs aren't teaching **when to stop**
- If agents under-deliver on simple tasks, your docs are **too cautious**
- The ideal doc set produces agents that scale their confidence correctly with complexity

## Implementation Phases

### Phase 1: Manual Baseline

- Create 2-3 fixtures by hand from recently merged PRs
- Write a simple runner (shell script + git worktrees)
- Run the three agents (Subject, Implementer, Oracle) manually
- Oracle evaluates by hand with a checklist, produces first report
- Establish baseline scores and initial run ledger

### Phase 2: Automated Single-Fixture Loop

- Build the run ledger and Oracle report generation
- Automate the implement → evaluate → diagnose → prescribe → re-trigger cycle
- Oracle proposes doc patches, loop applies them automatically
- Stopping conditions: convergence, cost ceiling, plateau detection
- Human reviews Oracle reports to validate the loop is learning

### Phase 3: Cross-Fixture + Regression Detection

- Add 5-8 fixtures covering major pattern categories
- Cross-fixture analysis: detect when a doc change helps one fixture but hurts another
- Oracle proposes unified patches that maximize improvement across all fixtures
- System variant versioning: every Oracle patch creates a snapshot
- `current-best` always points to the highest-scoring docs version

### Phase 4: Full Autonomy (HIVEMIND)

- Loop runs unattended: fixture suite → Oracle analysis → doc patch → re-run
- Auto-generate fixture candidates from new PRs
- Persistent agent identities: Subject agents accumulate domain knowledge across runs
- Swarm evaluation: multiple Implementers tackle same fixture, Oracle picks best patterns
- Score dashboard: track docs quality over time as a team metric
- CI integration: run on doc changes, block merges that regress fixture scores

## Open Questions

1. **Cost** — Each fixture run is a full agent session (now with multi-agent overhead + loop iterations). Batch API or cheaper models for initial screening? Budget per loop?
2. **Determinism** — Same prompt can produce different output. How many runs per fixture to get statistical significance? 3 minimum, 5 ideal? Does the Oracle average across runs?
3. **Fixture Freshness** — Patterns evolve. How to keep golden implementations in sync? Tag them to schema versions?
4. **Partial Credit** — An implementation that works but uses different patterns is... correct? wrong? The scoring weights encode your opinion here.
5. **Multi-Model** — Different models (Opus, Sonnet, Haiku) will score differently as Implementer. Track per-model or optimize for one?
6. **Subject Fidelity** — How realistic is a simulated domain expert? Should the Subject be seeded from actual Slack/issue conversations?
7. **Question Scoring** — How to weight "asked good questions" vs "produced good code"? An agent that asks nothing but gets it right is arguably better than one that asks great questions but still misses patterns.
8. **HIVEMIND Scope** — Where does the orchestrator end and HIVEMIND begin? Use SDK subagents for the core loop, HIVEMIND for cross-run intelligence?
9. **Oracle Reliability** — The Oracle is itself an LLM. Can it reliably diagnose *why* a score changed and propose the right fix? What if the Oracle's prescriptions oscillate (patch A → revert A → patch A)?
10. **Patch Granularity** — Should the Oracle propose one small change per iteration, or batch multiple fixes? Small = easier to attribute, large = faster convergence.
11. **Human Checkpoints** — At what confidence threshold should the Oracle auto-apply vs flag for human review? Low-confidence prescriptions could waste budget on bad experiments.
