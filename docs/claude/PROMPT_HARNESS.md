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
  epochs/                       # Parallel epoch history
    epoch-001/
      score-matrix.json        # Full tier × fixture grid
      analysis.json            # Oracle's decomposition + signal extraction
      report.md                # Human-readable summary
      signals/                 # Decomposed patch signals
        signal-001.json        # "Clarified route factory usage" → +0.10 simple, +0.05 medium
        signal-002.json        # "Removed complexity guidance" → -0.20 complex
      fixtures/                # Per-fixture results from this epoch
        endpoint-simple/
          output/
          eval.json
          qa-log.json
        endpoint-complex/
          ...
    epoch-002/
      ...
  master-ledger.json           # Full epoch history + current best variant
```

### Runner Modes

**Serial** — Run fixtures one at a time. Cheaper. Good for initial development.

**Parallel** — Run all fixtures concurrently in separate work trees. Use for full evaluation runs after a prompt change. Each work tree is independent so there's no cross-contamination.

**A/B** — Run the same fixture with two different system-prompt variants simultaneously. Directly compare which version produces better output for the same task.

### Git Branching Strategy

Each fixture run uses a **before/after branch model**. The "before" branch is the starting state the Implementer works from. The "after" (golden) lives in a branch the Implementer can never access. The Implementer's work happens on a fresh branch checked out from the "before."

```
  fixture: add-endpoint-simple
  │
  ├── fixture/add-endpoint-simple/before    ← Starting state (clean codebase)
  │     │
  │     └── agent/add-endpoint-simple/run-003  ← Implementer works here
  │           (checked out FROM before, never touches golden)
  │
  └── fixture/add-endpoint-simple/golden    ← Golden implementation
        (NEVER accessible to Implementer — different credentials)
```

#### Branch Naming Convention

```
fixture/{fixture-name}/before       # Starting state for this fixture
fixture/{fixture-name}/golden       # Golden implementation (Oracle-only)
agent/{fixture-name}/run-{NNN}      # Implementer's work branch (per run)
agent/{fixture-name}/run-{NNN}-eval # Oracle's evaluation workspace
```

#### The Before Branch

The "before" branch is a **snapshot of the codebase at the point where the fixture's task would begin.** It's the state a real developer would start from:

- Has the existing schema, routes, tests — everything except the feature being implemented
- May include scaffolding or setup that the prompt references ("We already have an Organization model")
- Is pinned to a specific commit, not a moving target
- Gets updated when the codebase changes significantly enough to warrant re-baselining

```ts
interface FixtureBranches {
  before: string;            // "fixture/add-endpoint-simple/before"
  golden: string;            // "fixture/add-endpoint-simple/golden"
  beforeCommit: string;      // Pinned commit SHA on the before branch
  goldenCommit: string;      // Pinned commit SHA on the golden branch
  lastRebaseDate: string;    // When before/golden were last synced with main
}
```

#### The Run Lifecycle

```
1. CHECKOUT — Create agent branch from the before branch
   git worktree add /tmp/harness-run-{id} fixture/{name}/before
   cd /tmp/harness-run-{id}
   git checkout -b agent/{name}/run-{NNN}

2. CONFIGURE — Copy system-variant docs into the work tree
   (Implementer sees CLAUDE.md + docs/claude/*.md from the variant being tested)

3. IMPLEMENT — Spawn Implementer with scoped token (see Agent Isolation below)
   Implementer works on agent/{name}/run-{NNN}
   All commits go to this branch
   Implementer can ask Subject questions via orchestrator

4. CAPTURE — Diff the agent branch against the before branch
   git diff fixture/{name}/before..agent/{name}/run-{NNN}
   This is the Implementer's total output

5. EVALUATE — Spawn Oracle in a SEPARATE worktree
   git worktree add /tmp/harness-eval-{id} fixture/{name}/golden
   Oracle diffs agent output against golden
   Oracle runs golden tests against agent code
   Oracle has different credentials — CAN read golden, CANNOT write

6. CLEANUP — Remove worktrees
   git worktree remove /tmp/harness-run-{id}
   git worktree remove /tmp/harness-eval-{id}
   Agent branches are kept for history (pruned by age)
```

### Agent Isolation via Git Credentials

Instructions aren't enough. "Don't read the golden branch" in a system prompt is a suggestion, not a guarantee. The Implementer agent gets **credentials that physically cannot access the golden branches.** This is the hard boundary.

#### Token Scoping

Three credential sets, each with different repository access:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CREDENTIAL ISOLATION                               │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  IMPLEMENTER     │  │  ORACLE          │  │  ORCHESTRATOR    │  │
│  │  TOKEN           │  │  TOKEN           │  │  TOKEN           │  │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤  │
│  │ CAN:             │  │ CAN:             │  │ CAN:             │  │
│  │ • Read before    │  │ • Read golden    │  │ • Read all       │  │
│  │   branches       │  │   branches       │  │   branches       │  │
│  │ • Read/write     │  │ • Read agent     │  │ • Create agent   │  │
│  │   agent branches │  │   branches       │  │   branches       │  │
│  │ • Read main      │  │ • Read before    │  │ • Create/remove  │  │
│  │                  │  │   branches       │  │   worktrees      │  │
│  │ CANNOT:          │  │                  │  │ • Manage tokens  │  │
│  │ • Read golden    │  │ CANNOT:          │  │                  │  │
│  │   branches       │  │ • Write to any   │  │                  │  │
│  │ • Read fixture   │  │   branch         │  │                  │  │
│  │   eval configs   │  │ • Read system    │  │                  │  │
│  │ • Read other     │  │   variant source │  │                  │  │
│  │   agent runs     │  │                  │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Implementation Options

**Option A: GitHub Fine-Grained PATs + Branch Protection Rules**

GitHub fine-grained personal access tokens can be scoped per-repository but not per-branch. Use branch protection rules to enforce:

```yaml
# Branch protection: fixture/*/golden
- Restrict pushes: orchestrator-bot only
- Require PR review: never bypass
- No force push

# The Implementer token is a standard PAT that can read/write the repo
# but golden branches are protected from writes
# Problem: Implementer CAN still READ golden branches
```

This doesn't fully solve read isolation. For that:

**Option B: Separate Repositories (Strongest Isolation)**

```
repo: template                  ← Implementer works here
  branches: main, fixture/*/before, agent/*

repo: template-golden           ← Oracle reads from here
  branches: fixture/*/golden, fixture/*/eval-config
  permissions: Oracle token has read access, Implementer token does NOT
```

The golden implementations live in a completely separate repo. The Implementer's token has zero access to it. The Oracle's token can read both repos.

```ts
interface RepoConfig {
  // Implementer sees this repo
  workRepo: {
    url: string;              // "github.com/org/template"
    token: string;            // Scoped: read main + before, write agent/*
  };
  // Oracle sees this repo (in addition to workRepo for reading agent output)
  goldenRepo: {
    url: string;              // "github.com/org/template-golden"
    token: string;            // Scoped: read-only
  };
}
```

**Option C: Git Credential Helpers + Worktree Isolation (Local)**

For local runs, configure each worktree with a different git credential helper:

```bash
# Implementer worktree — credential helper returns implementer token
git worktree add /tmp/harness-impl-{id} fixture/{name}/before
cd /tmp/harness-impl-{id}
git config credential.helper "!echo protocol=https; echo host=github.com; echo username=implementer-bot; echo password=${IMPL_TOKEN}"

# Remove golden remote entirely from Implementer's worktree
git remote set-branches origin --add 'fixture/*/before'
git remote set-branches origin --add 'agent/*'
# Golden branches are never fetched into this worktree

# Oracle worktree — different credential helper, read-only
git worktree add /tmp/harness-eval-{id} fixture/{name}/golden
cd /tmp/harness-eval-{id}
git config credential.helper "!echo protocol=https; echo host=github.com; echo username=oracle-bot; echo password=${ORACLE_TOKEN}"
```

The Implementer's worktree literally doesn't have the golden branches in its refspec. Even if the agent tries `git fetch origin fixture/*/golden`, the credentials won't allow it.

#### Recommended Approach

Start with **Option C** (local worktree isolation) for development — it's fast and doesn't require repo infrastructure changes. Move to **Option B** (separate repos) for production/CI where the isolation guarantee needs to be absolute.

Option A is the weakest but simplest — good enough if you trust the system prompt to prevent the Implementer from *trying* to read golden (the protection is against accidental reads, not adversarial ones).

### Session & Orchestration

The harness needs to keep multiple agent sessions alive, route messages between them, handle failures, and maintain state across potentially long-running fixture evaluations.

#### The Orchestrator Process

The orchestrator is the only process with full access. It spawns and manages all other agents:

```
┌──────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                                 │
│                                                                   │
│  Responsibilities:                                                │
│  • Create/destroy git worktrees                                  │
│  • Spawn agent sessions with scoped credentials                  │
│  • Route Q&A messages between Implementer ↔ Subject              │
│  • Collect Implementer output when done                          │
│  • Hand output to Oracle for evaluation                          │
│  • Record results to ledger                                      │
│  • Apply Oracle prescriptions to doc variants                    │
│  • Trigger next iteration of the loop                            │
│                                                                   │
│  State:                                                           │
│  • Active worktrees (path, fixture, status)                      │
│  • Active agent sessions (PID, role, fixture)                    │
│  • Current doc variant being tested                              │
│  • Cost accumulator                                               │
│  • Loop iteration counter                                        │
└──────────────────────────────────────────────────────────────────┘
```

#### Watchdog / Session Health

Long-running agent sessions can stall, hit token limits, or crash. The orchestrator includes a watchdog that monitors agent health:

```ts
interface AgentSession {
  pid: number;                  // OS process ID
  role: "subject" | "implementer" | "oracle";
  fixture: string;
  startedAt: string;
  lastActivity: string;         // Last tool call or output
  status: "running" | "stalled" | "completed" | "failed" | "timeout";
  maxDuration: number;          // Per-role timeout (ms)
  costSoFar: number;
}

interface WatchdogConfig {
  stallThreshold: number;       // No activity for N seconds → stalled
  maxDuration: {
    implementer: number;        // 15 min for simple, 30 min for complex
    oracle: number;             // 10 min (evaluation is faster)
    subject: number;            // 5 min per question (shouldn't take long)
  };
  onStall: "warn" | "restart" | "kill";
  onTimeout: "capture_partial" | "kill";
  healthCheckInterval: number;  // Check every N seconds
}
```

#### What Happens on Failure

```
Agent stalls (no output for stallThreshold):
  1. Log warning to orchestrator
  2. If implementer: capture partial output, mark run as "incomplete"
  3. Oracle still evaluates partial output (valuable signal — where did it get stuck?)
  4. Don't restart automatically — partial results are more useful than a retry
     that might hit the same wall

Agent crashes (process exits non-zero):
  1. Log error + stack trace
  2. Capture any output written to worktree before crash
  3. Mark run as "failed" with crash details
  4. Oracle evaluates whatever was produced (even nothing — that's a data point)

Agent hits token/cost limit:
  1. Capture output at the point of exhaustion
  2. Mark run as "truncated"
  3. Oracle evaluates partial output
  4. Flag in ledger: "budget_exceeded" — may need to simplify the fixture
     or increase per-run budget

Worktree conflict (shouldn't happen but might):
  1. Each run gets a unique worktree path: /tmp/harness-{fixture}-{run-id}-{timestamp}
  2. If path exists, fail fast — don't silently reuse
  3. Stale worktrees are cleaned up by the orchestrator at startup
```

#### Parallel Session Management

When running all fixtures in parallel, the orchestrator manages N concurrent sessions:

```ts
interface ParallelRunConfig {
  maxConcurrent: number;         // Limit parallel agent sessions (memory/API rate limits)
  staggerDelay: number;          // Delay between session starts (avoid API burst)
  worktreeRoot: string;          // Parent dir for all worktrees
  cleanupOnComplete: boolean;    // Remove worktrees after evaluation
  preserveOnFailure: boolean;    // Keep failed worktrees for debugging
}

// Default: 4 concurrent (2 Implementer + 2 Oracle at any time)
// Implementer sessions are the bottleneck — they take longest and cost most
// Oracle sessions are fast — evaluation is cheaper than implementation
// Subject sessions are ephemeral — they only exist during Q&A exchanges
```

The orchestrator uses a work queue:

```
1. Enqueue all fixtures
2. Pop fixture from queue
3. If under maxConcurrent: start worktree + spawn Implementer
4. When Implementer finishes: spawn Oracle (in parallel with next Implementer)
5. When Oracle finishes: record results, clean up worktree
6. Repeat until queue empty
7. All results collected → Oracle meta-analysis (cross-fixture, signal extraction)
```

This means Implementer N+1 can start while Oracle N is still evaluating — pipeline parallelism. The bottleneck is Implementer sessions (expensive, slow). Oracle sessions are cheap and fast.

#### HIVEMIND Event Flow

With HIVEMIND coordinating, the orchestrator doesn't need custom IPC. Everything flows through events:

```
Orchestrator:
  hivemind_emit type=fixture_start fixture=add-endpoint-simple run=003

Implementer (registered as agent, has scoped token):
  hivemind_emit type=question target=subject content="Soft or hard delete?"
  hivemind_query type=answer source=subject  # Blocks until Subject responds

Subject (registered as agent):
  hivemind_query type=question target=subject  # Polls for questions
  hivemind_emit type=answer target=implementer content="Soft delete."

Implementer:
  hivemind_emit type=implementation_complete run=003

Orchestrator:
  hivemind_emit type=evaluation_start fixture=add-endpoint-simple run=003

Oracle (registered as agent, has golden-access token):
  hivemind_query type=implementation_complete run=003  # Gets agent output
  hivemind_query type=question run=003                 # Gets full Q&A log
  hivemind_emit type=evaluation_complete run=003 scores={...}
  hivemind_emit type=diagnosis run=003 diagnosis={...}
  hivemind_emit type=prescription run=003 prescription={...}

Orchestrator:
  hivemind_query type=prescription run=003  # Gets Oracle's recommendation
  # Applies patch, triggers next run
```

The event log IS the run ledger. Every event has a timestamp, agent ID, and fixture context. The ledger is reconstructed from events rather than being a separate data store.

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

### The Master Ledger (Parallel Epochs)

When running all fixtures in parallel, results are tracked per-epoch rather than per-fixture-run.

```ts
interface MasterLedger {
  epochs: ParallelEpochResult[];
  previousEpoch: ParallelEpochResult | null;
  lastPatch: Prescription | null;
}

interface ParallelEpochResult {
  epoch: number;
  timestamp: string;
  variant: string;                        // Docs version ID
  patch: Prescription | null;             // Patch applied before this epoch
  fixtureResults: FixtureResult[];        // ALL fixtures from this epoch
  analysis: {
    uniformlyPositive: string[];          // Fixtures that improved
    neutral: string[];                    // No significant change
    regressions: string[];                // Fixtures that got worse
    signals: PatchSignal[];               // Decomposed patch signals
  };
  nextAction: "accept_full" | "extract_positive" | "reject_full" | "escalate";
  scoreMatrix: ScoreMatrix;               // Full tier × fixture grid
}

// The score matrix gives the Oracle a bird's-eye view
interface ScoreMatrix {
  byFixture: Record<string, {
    tier: "simple" | "medium" | "complex";
    composite: number;
    delta: number;                        // Change from previous epoch
    scores: EvalResult["scores"];
  }>;
  byTier: {
    simple:  { avgComposite: number; avgDelta: number };
    medium:  { avgComposite: number; avgDelta: number };
    complex: { avgComposite: number; avgDelta: number };
  };
  overall: { avgComposite: number; avgDelta: number };
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

### Parallel Execution + Positive Extraction

The key to preventing regressions: **every doc change is tested against ALL fixtures simultaneously.** No change gets applied until we know its impact across every tier.

```
  Doc Patch Proposed
       │
       ▼
  ┌────────────────────────────────────────────────────┐
  │  PARALLEL RUN (all fixtures, same doc change)       │
  │                                                     │
  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
  │  │ endpoint    │  │ endpoint    │  │ endpoint   │ │
  │  │ simple      │  │ medium      │  │ complex    │ │
  │  │ score: 0.95 │  │ score: 0.80 │  │ score: 0.40│ │
  │  │ ▲ +0.10     │  │ ▲ +0.05     │  │ ▼ -0.20   │ │
  │  └─────────────┘  └─────────────┘  └────────────┘ │
  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
  │  │ schema      │  │ background  │  │ permissions│ │
  │  │ simple      │  │ job medium  │  │ medium     │ │
  │  │ score: 0.90 │  │ score: 0.85 │  │ score: 0.75│ │
  │  │ ▲ +0.05     │  │ ── 0.00     │  │ ▲ +0.10   │ │
  │  └─────────────┘  └─────────────┘  └────────────┘ │
  └────────────────────────────────────────────────────┘
       │
       ▼
  Oracle sees ALL results at once
       │
       ▼
  ┌────────────────────────────────────────────────────┐
  │  ANALYSIS                                           │
  │                                                     │
  │  Uniformly positive: endpoint-simple, schema-simple │
  │  Neutral: background-job-medium                     │
  │  Regression: endpoint-complex (-0.20)               │
  │                                                     │
  │  Root cause: doc change clarified route patterns    │
  │  (helped simple/medium) but removed nuance about    │
  │  when to use skeleton approach (hurt complex)       │
  │                                                     │
  │  EXTRACTION: Keep the route pattern clarification.  │
  │  Add back the complexity guidance as a separate     │
  │  section so both signals coexist.                   │
  └────────────────────────────────────────────────────┘
       │
       ▼
  Refined patch (positive parts only) → next parallel run
```

#### The Extraction Problem

A doc patch is rarely uniformly good or bad. It usually contains multiple signals:

- **Signal A**: Clearer example of route factory usage → helps simple + medium
- **Signal B**: Removed a paragraph about "when patterns get complex, scaffold first" → hurts complex

The naive approach (accept/reject the whole patch) throws away Signal A when Signal B causes a regression. The Oracle needs to **decompose** the patch and extract what worked.

```ts
interface ParallelEpochResult {
  epoch: number;
  variant: string;                    // Which docs version was tested
  patch: Prescription;                // The patch that was applied
  fixtureResults: FixtureResult[];    // ALL fixtures run in parallel
  analysis: {
    uniformlyPositive: string[];      // Fixtures that improved
    neutral: string[];                // No significant change
    regressions: string[];            // Fixtures that got worse
    // The Oracle's decomposition of the patch
    signals: PatchSignal[];
  };
  nextAction: "accept_full" | "extract_positive" | "reject_full" | "escalate";
}

interface PatchSignal {
  id: string;
  description: string;               // What this part of the patch does
  affectedFixtures: {
    fixture: string;
    impact: number;                   // +/- delta
  }[];
  netImpact: number;                  // Sum across all fixtures
  keep: boolean;                      // Oracle's recommendation
}
```

#### The Parallel Refinement Loop

```ts
async function parallelRefinementLoop(
  fixtures: Fixture[],
  initialVariant: SystemVariant,
  options: { maxEpochs: number; costCeiling: number }
) {
  const masterLedger: MasterLedger = await loadOrCreateMasterLedger();
  let currentVariant = initialVariant;
  let totalCost = 0;

  for (let epoch = 0; epoch < options.maxEpochs; epoch++) {

    // --- 1. RUN ALL FIXTURES IN PARALLEL ---
    // Every fixture gets the exact same docs version
    const results = await Promise.all(
      fixtures.map(f => runFixture(f, currentVariant))
    );
    totalCost += results.reduce((sum, r) => sum + r.cost, 0);

    // --- 2. ORACLE ANALYZES THE FULL MATRIX ---
    // Oracle sees every fixture × every tier in one pass
    const analysis = await query({
      prompt: `
        You are the Oracle. A doc change was applied and ALL fixtures ran in parallel.

        PREVIOUS EPOCH RESULTS (baseline):
        ${JSON.stringify(masterLedger.previousEpoch?.results)}

        CURRENT EPOCH RESULTS:
        ${JSON.stringify(results)}

        DOC PATCH THAT WAS APPLIED:
        ${JSON.stringify(masterLedger.lastPatch)}

        FULL HISTORY:
        ${JSON.stringify(masterLedger.epochs)}

        Your job:
        1. CLASSIFY each fixture result: improved / neutral / regressed
        2. DECOMPOSE the doc patch into independent signals
           - Which part of the change caused which fixture to improve?
           - Which part caused which fixture to regress?
        3. EXTRACT the positive signals:
           - If uniformly positive → accept the full patch
           - If mixed → propose a refined patch keeping only the positive signals
           - If uniformly negative → reject and try a fundamentally different approach
        4. PRESCRIBE the next patch (either the extracted positive parts,
           or a new approach if the current direction isn't working)

        CRITICAL: A patch that improves simple fixtures but regresses complex
        fixtures is NOT acceptable. The goal is monotonic improvement across
        ALL tiers, or at minimum no regressions at any tier.
      `,
      options: {
        allowedTools: ["Read", "Grep", "Glob"],
        model: "opus"  // Use strongest model — this is the hardest reasoning step
      }
    });

    // --- 3. RECORD ---
    const epochEntry: ParallelEpochResult = {
      epoch,
      variant: currentVariant.id,
      patch: masterLedger.lastPatch,
      fixtureResults: results,
      analysis: analysis.parsed,
      nextAction: analysis.nextAction,
    };
    masterLedger.epochs.push(epochEntry);
    await saveMasterLedger(masterLedger);

    // --- 4. STOPPING CONDITIONS ---
    if (allConverged(results, fixtures)) {
      console.log(`All fixtures converged at epoch ${epoch}`);
      break;
    }
    if (totalCost >= options.costCeiling) break;
    if (isMasterPlateau(masterLedger, 3)) break;

    // --- 5. APPLY EXTRACTED POSITIVE CHANGES ---
    switch (analysis.nextAction) {
      case "accept_full":
        // Patch was uniformly good — keep it, propose next improvement
        masterLedger.lastPatch = analysis.nextPrescription;
        currentVariant = await applyPatch(currentVariant, analysis.nextPrescription);
        break;

      case "extract_positive":
        // Mixed results — revert to pre-patch, apply only the good parts
        currentVariant = await loadVariant(masterLedger.previousEpoch.variant);
        const extractedPatch = buildPatchFromSignals(
          analysis.parsed.signals.filter(s => s.keep)
        );
        currentVariant = await applyPatch(currentVariant, extractedPatch);
        masterLedger.lastPatch = extractedPatch;
        break;

      case "reject_full":
        // Nothing worked — revert and try a different direction
        currentVariant = await loadVariant(getBestEpoch(masterLedger).variant);
        masterLedger.lastPatch = analysis.alternativePrescription;
        currentVariant = await applyPatch(currentVariant, analysis.alternativePrescription);
        break;

      case "escalate":
        // Oracle doesn't know what to do — flag for human review
        console.log(`Epoch ${epoch}: Oracle escalated for human review`);
        await notifyHuman(epochEntry);
        break;
    }

    await saveVariant(currentVariant);
  }

  return {
    masterLedger,
    bestVariant: await loadVariant(getBestEpoch(masterLedger).variant),
    finalScores: masterLedger.epochs.at(-1)?.fixtureResults,
  };
}
```

#### Why Parallel-First Matters

The serial approach (one fixture at a time, hope for the best) has a fundamental problem: you optimize for fixture A, then discover the change broke fixture B, then you fix B and break A again. You oscillate.

The parallel approach makes this impossible:

1. **Every change is tested against everything** — no blind spots
2. **Regressions are caught before they're committed** — the Oracle sees the full matrix
3. **Positive signals are extracted, not discarded** — a partially-good patch still contributes
4. **The Oracle learns which changes are safe** — signals that are consistently positive across tiers become high-confidence improvements
5. **Complex-tier fixtures act as guardrails** — they prevent the docs from being simplified past the point where agents lose their ability to recognize uncertainty

### Perturbation Strategy (Escaping Local Optima)

The Oracle's gradient descent can get stuck. It finds a doc structure that scores 0.85 and keeps making tiny edits — reword this sentence, add an example there — gaining 0.001 per epoch. The score plateaus because the fundamental *structure* of the docs is a local optimum. A completely different organization might score 0.95, but the Oracle will never find it through incremental edits.

The solution: **periodically introduce controlled chaos.** Remove a section, split a doc in two, combine two docs, reorder sections, strip all examples, strip all explanations and leave only examples. Force the system off its current hill so it can find a higher one.

This is simulated annealing applied to documentation.

#### Perturbation Types

```
┌──────────────────────────────────────────────────────────────────┐
│                    PERTURBATION CATALOG                            │
│                                                                   │
│  STRUCTURAL (change doc organization)                             │
│  ├── SPLIT    — Break one doc into two by section                │
│  ├── MERGE    — Combine two related docs into one                │
│  ├── REORDER  — Shuffle section ordering within a doc            │
│  ├── FLATTEN  — Collapse knowledge tree depth (3→2 levels)       │
│  ├── DEEPEN   — Add knowledge tree depth (2→3 levels)            │
│  │                                                                │
│  CONTENT (change what's in the docs)                              │
│  ├── STRIP_EXAMPLES   — Remove all code examples, keep prose     │
│  ├── STRIP_PROSE      — Remove all prose, keep only examples     │
│  ├── STRIP_SECTION    — Remove a specific section entirely       │
│  ├── CONDENSE         — Aggressively shorten (50% reduction)     │
│  ├── EXPAND           — Add more explanation and examples        │
│  │                                                                │
│  RADICAL (fundamentally different approach)                        │
│  ├── EXAMPLE_ONLY     — Replace entire doc set with just         │
│  │                       annotated code examples, no prose       │
│  ├── CHECKLIST        — Replace with step-by-step checklists     │
│  ├── DECISION_TREE    — Replace with "if X then do Y" trees      │
│  ├── REFERENCE_ONLY   — Just point to files: "see src/x.ts:15"  │
│  └── FRESH_START      — Oracle writes docs from scratch given    │
│                          only the golden implementations         │
└──────────────────────────────────────────────────────────────────┘
```

#### When to Perturb

Perturbation isn't random — it's triggered by specific conditions:

```ts
interface PerturbationConfig {
  // Trigger conditions
  triggers: {
    plateauEpochs: number;      // Perturb after N epochs without improvement (default: 3)
    minScoreBeforePerturb: number; // Don't perturb if score is below this (default: 0.5)
    maxPerturbsPerCycle: number;   // Cap chaos injection (default: 3)
  };

  // Annealing schedule — chaos decreases over time
  temperature: {
    initial: number;            // How aggressive perturbations are at start (0-1)
    decay: number;              // Reduce temperature by this factor each cycle
    minimum: number;            // Never go below this (always allow some chaos)
  };

  // What to try
  allowedTypes: PerturbationType[];

  // Safety
  alwaysKeepBestVariant: boolean;  // Never overwrite the known best (default: true)
}
```

#### The Annealing Schedule

Early in refinement, temperature is high — the system tries radical perturbations (fresh start, example-only, decision trees). As scores improve, temperature drops — perturbations become smaller (reorder sections, condense a paragraph). But temperature never hits zero — there's always a chance of a radical shake-up.

```
Temperature: 0.8                Temperature: 0.3              Temperature: 0.1
(Early refinement)              (Mid refinement)              (Late refinement)

Possible perturbations:         Possible perturbations:       Possible perturbations:
• FRESH_START         30%       • REORDER             40%     • CONDENSE            50%
• EXAMPLE_ONLY        25%       • SPLIT               25%     • REORDER             30%
• STRIP_SECTION       20%       • STRIP_EXAMPLES      20%     • STRIP_SECTION       15%
• MERGE               15%       • CONDENSE            15%     • FRESH_START          5%
• CONDENSE            10%
```

#### Perturbation Epoch Flow

```
Normal epoch:     variant_v5 → run fixtures → score 0.84 → Oracle patches → variant_v6
Normal epoch:     variant_v6 → run fixtures → score 0.84 → Oracle patches → variant_v7
Normal epoch:     variant_v7 → run fixtures → score 0.84 → PLATEAU DETECTED
                                                              │
Perturbation:     variant_v7 → STRIP_PROSE → variant_v7p     │
                  variant_v7p → run fixtures → score 0.72     │ (worse, but different hill)
                  Oracle patches variant_v7p → variant_v8     │
                  variant_v8 → run fixtures → score 0.79      │ (climbing new hill)
                  variant_v8 → Oracle patches → variant_v9    │
                  variant_v9 → run fixtures → score 0.88      │ (surpassed old plateau!)
                                                              │
                  Best variant updated: v5 → v9               ▼
```

The key: **always keep the best variant safe.** Perturbation explores from the current position, but if every perturbation leads downhill, the system reverts to the best known variant and tries a different perturbation type. The known best is never overwritten.

#### What the Oracle Learns from Perturbation

Perturbations produce valuable meta-signals:

| Perturbation | Result | What It Means |
|-------------|--------|--------------|
| STRIP_EXAMPLES → score drops | Examples are critical | Docs need more examples, not more prose |
| STRIP_PROSE → score holds | Prose isn't helping | Agents work from examples; prose is noise |
| STRIP_PROSE → score drops | Prose provides context | Examples alone aren't enough, need explanation |
| MERGE two docs → score improves | Separation was artificial | Agents were losing context switching between docs |
| SPLIT one doc → score improves | Doc was too long | Agents were loading unnecessary context |
| FRESH_START → score jumps | Original structure was bad | Let the Oracle redesign from scratch more often |
| FRESH_START → score tanks | Original structure was good | The current approach is working, just needs tuning |
| EXAMPLE_ONLY → complex improves | Complex tasks benefit from seeing more code | Add more examples for complex patterns |
| CHECKLIST → simple improves | Simple tasks are procedural | Checklists work for rote tasks, prose for judgment |

These signals feed back into the Oracle's diagnosis. Instead of just "improve this doc," the Oracle can say "the perturbation data shows that examples matter more than prose for route patterns — restructure API_ROUTES.md to be example-heavy."

#### Cost of Chaos

Perturbation epochs are more expensive because they explore dead ends. Budget for ~30% of epochs being perturbation epochs in the early phase, dropping to ~10% later. The payoff: escaping local optima that incremental refinement can never find.

```ts
// Rough cost model
const perturbationBudget = {
  early: 0.3,    // 30% of epochs are perturbations (high temperature)
  mid: 0.15,     // 15% of epochs
  late: 0.05,    // 5% of epochs (near convergence, mostly incremental)
};

// Example: 20-epoch refinement cycle
// Early (epochs 1-6):   2 perturbation epochs
// Mid (epochs 7-14):    1 perturbation epoch
// Late (epochs 15-20):  1 perturbation epoch
// Total: 4 perturbation epochs out of 20 (~20% overhead)
```

### HIVEMIND Integration

The harness coordinates its agents through [HIVEMIND](https://github.com/inixiative/hivemind) — a multi-agent coordination system for Claude Code that uses MCP, SQLite, and PID-based agent tracking.

HIVEMIND provides exactly what the harness needs:
- **Event-based messaging** between agents (`hivemind_emit` / `hivemind_query`)
- **Persistent plans and tasks** that survive across sessions
- **Agent lifecycle management** via PID monitoring (no heartbeats)
- **Git worktree coordination** to prevent conflicts across parallel runs

```
┌─────────────────────────────────────────────────────────┐
│                 HIVEMIND (MCP Server)                     │
│  SQLite: ~/.hivemind/claude_hivemind_{project}/          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  agents  │  │  events  │  │  plans   │  │  tasks  │ │
│  │  table   │  │  table   │  │  table   │  │  table  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└────────┬──────────────┬──────────────┬──────────────────┘
         │              │              │
         ▼              ▼              ▼
  ┌────────────┐ ┌────────────┐ ┌────────────┐
  │ Subject    │ │ Implementer│ │ Oracle     │
  │ (Claude    │ │ (Claude    │ │ (Claude    │
  │  session)  │ │  session)  │ │  session)  │
  └────────────┘ └────────────┘ └────────────┘
```

#### How Agents Use HIVEMIND

Each harness agent is a Claude session registered via `hivemind_register`. They communicate through events, not direct calls:

```
# Implementer asks a question
hivemind_emit type=question content="Should project delete be soft or hard?"

# Subject sees the question via hivemind_query, responds
hivemind_emit type=answer content="Soft delete. Keep for audit trails."

# Implementer queries for answers, continues implementation
# Oracle observes the full event stream after the run
```

**Plans** map to fixtures. A fixture run creates a HIVEMIND plan with tasks for each phase (implement, evaluate, diagnose, prescribe). Tasks are claimed by the appropriate agent, preventing duplication when running in parallel.

**Events** are the Q&A log, the score reports, the Oracle's diagnoses — all captured in HIVEMIND's event table with timestamps and metadata. The ledger is built from events rather than being a separate system.

#### Harness-Specific MCP Tools

On top of HIVEMIND's core tools, the harness exposes its own MCP tools for fixture management and evaluation:

```ts
// packages/prompt-harness/src/mcp/harness-server.ts
// Tools:
//   harness_run_fixture     — run a single fixture against a docs variant
//   harness_evaluate        — score agent output against golden
//   harness_diagnostic      — run basic or age diagnostic
//   harness_get_golden      — retrieve golden implementation for a fixture
//   harness_get_signatures  — get pattern signatures for a fixture
//   harness_compare         — compare two docs variants across all fixtures
//   harness_refine          — start the refinement loop
```

Claude can use these tools directly:
```
User: "Run the add-endpoint-simple fixture with the current docs and tell me how it scores"
Claude: [calls harness_run_fixture] → [calls harness_evaluate] → [queries hivemind events for history]
        → "Score: 0.85 (up from 0.78). Pattern compliance improved because..."
```

## Multi-Model Documentation

Different models reason differently. Docs optimized for Opus may be too verbose for Haiku. The harness can generate **model-specific doc variants** and **model-specific test expectations**.

### Per-Model Fixtures

Each fixture can define model-specific golden implementations and scoring weights:

```
fixtures/
  add-endpoint-simple/
    prompt.md
    subject-context.md
    eval.config.ts              # Default eval config
    models/
      opus/
        eval.config.ts          # Opus-specific weights (higher pattern expectations)
        golden/                 # What Opus should produce
      sonnet/
        eval.config.ts          # Sonnet-specific weights
        golden/                 # What Sonnet should produce (may accept simpler patterns)
      haiku/
        eval.config.ts          # Haiku-specific weights (lower expectations, focus on correctness)
        golden/                 # What Haiku should produce (minimal but correct)
    golden/                     # Default golden (used when no model-specific one exists)
```

### Per-Model Doc Variants

The refinement loop can optimize docs **per model**. Different models may need different documentation styles:

```
system-variants/
  baseline/                     # Current docs — same for all models
  opus-optimized/               # Concise, pattern-focused (Opus infers well from examples)
  sonnet-optimized/             # Balanced (good examples + some explanation)
  haiku-optimized/              # Explicit, step-by-step (Haiku needs more guidance)
```

### Model-Specific Scoring

```ts
interface ModelConfig {
  model: "opus" | "sonnet" | "haiku";
  expectedTier: {
    // What complexity tier this model should handle well
    simple: "full";              // All models should nail simple
    medium: "full" | "core";     // Opus: full, Sonnet: full, Haiku: core
    complex: "skeleton" | "core" | "full";  // Varies by model
  };
  weights: {
    // Different models get different scoring emphasis
    pattern: number;             // Opus: high, Haiku: low
    restraint: number;           // Haiku: high (better to stop than guess)
    questioning: number;         // All: medium
  };
  costMultiplier: number;        // For budget calculations
}

const modelConfigs: Record<string, ModelConfig> = {
  opus: {
    model: "opus",
    expectedTier: { simple: "full", medium: "full", complex: "core" },
    weights: { pattern: 0.3, restraint: 0.1, questioning: 0.2 },
    costMultiplier: 5.0,
  },
  sonnet: {
    model: "sonnet",
    expectedTier: { simple: "full", medium: "full", complex: "skeleton" },
    weights: { pattern: 0.2, restraint: 0.2, questioning: 0.2 },
    costMultiplier: 1.0,
  },
  haiku: {
    model: "haiku",
    expectedTier: { simple: "full", medium: "core", complex: "skeleton" },
    weights: { pattern: 0.1, restraint: 0.3, questioning: 0.2 },
    costMultiplier: 0.2,
  },
};
```

### Cross-Model Analysis

The parallel suite can run the same fixture across all models simultaneously:

```bash
# Run the same fixture on all three models
bun run harness run add-endpoint-simple --models opus,sonnet,haiku

# Generate model-specific doc recommendations
bun run harness refine --model opus --max-epochs 5
bun run harness refine --model sonnet --max-epochs 5
bun run harness refine --model haiku --max-epochs 10  # More iterations, cheaper per run
```

The Oracle's cross-model analysis answers:
- "Opus gets 0.95 but Haiku gets 0.60 on the same fixture — what doc changes would bring Haiku up without affecting Opus?"
- "Sonnet asks better clarifying questions than Opus — what can we learn from its Q&A pattern?"
- "Haiku correctly stops at skeleton for complex tasks while Opus overreaches — Haiku's restraint is better here"

This naturally produces **model-specific doc variants**: the docs that work best for each model, maintained by the loop, tracked in the ledger.

## Knowledge Tree Architecture

The flat `docs/claude/*.md` files work for humans but are inefficient for agents. An agent doing a schema change shouldn't need to load the permissions doc. The knowledge tree is a **retrieval-optimized** structure where the agent navigates to what it needs in 2-3 hops.

### The Problem with Flat Docs

Today:
```
CLAUDE.md says "read DATABASE.md for schema changes"
→ Agent loads all of DATABASE.md (2000 lines)
→ Agent only needed the section on model utilities (50 lines)
→ 97% of loaded context was wasted
```

With the knowledge tree:
```
CLAUDE.md says "database/" for schema changes
→ Agent reads database/index.md (30 lines, lists 8 concepts)
→ Agent reads database/concepts/model-utilities.md (50 lines)
→ Agent has exactly what it needs
```

### Three-Level Structure

```
knowledge/
  index.md                              # Level 0: TOP-LEVEL ROUTER
  │                                     # "What are you doing? → go to this domain"
  │                                     # Lists all domains with 1-line descriptions
  │                                     # ~30 lines. Always loaded.
  │
  ├── api-routes/                       # Level 1: DOMAIN
  │   ├── index.md                      # Domain overview + concept listing
  │   │                                 # "Here's what's in this domain, pick what you need"
  │   │                                 # ~50 lines. Loaded when domain is relevant.
  │   └── concepts/                     # Level 2: CONCEPTS
  │       ├── route-factory.md          # createRouteConfig pattern + examples
  │       ├── schema-validation.md      # Zod schemas for routes
  │       ├── error-handling.md         # Error responses, status codes
  │       ├── middleware.md             # Auth, rate limiting, etc.
  │       └── testing.md               # Route test patterns
  │
  ├── database/
  │   ├── index.md
  │   └── concepts/
  │       ├── prisma-patterns.md        # Query patterns, relations
  │       ├── model-utilities.md        # Model helper functions
  │       ├── migrations.md             # Schema changes, prisma push
  │       ├── extensions.md             # Prisma extensions
  │       └── seeding.md               # Seed data patterns
  │
  ├── hooks/
  │   ├── index.md
  │   └── concepts/
  │       ├── lifecycle.md              # beforeCreate, afterUpdate, etc.
  │       ├── validation.md             # Input validation in hooks
  │       ├── cache-invalidation.md     # When and how to bust cache
  │       └── webhooks.md              # External webhook dispatch
  │
  ├── permissions/
  │   ├── index.md
  │   └── concepts/
  │       ├── roles.md
  │       ├── entitlements.md
  │       ├── middleware.md
  │       └── permix.md
  │
  ├── jobs/
  │   ├── index.md
  │   └── concepts/
  │       ├── bullmq.md
  │       ├── crons.md
  │       └── workers.md
  │
  └── frontend/
      ├── index.md
      └── concepts/
          ├── routing.md
          ├── data-tables.md
          ├── state.md
          └── components.md
```

### How the Agent Navigates

```
Task: "Add a CRUD endpoint for Projects with hooks"

Step 1: Read knowledge/index.md
  → Sees: "api-routes/ — Adding endpoints, controllers, route templates"
  → Sees: "hooks/ — Mutation lifecycle, validation, cache"
  → Decides: needs api-routes + hooks

Step 2: Read knowledge/api-routes/index.md
  → Sees concept list: route-factory, schema-validation, error-handling, middleware, testing
  → Decides: needs route-factory, schema-validation, testing

Step 3: Read knowledge/hooks/index.md
  → Sees concept list: lifecycle, validation, cache-invalidation, webhooks
  → Decides: needs lifecycle, validation

Step 4: Load ONLY these concept files:
  → api-routes/concepts/route-factory.md        (40 lines)
  → api-routes/concepts/schema-validation.md    (35 lines)
  → api-routes/concepts/testing.md              (45 lines)
  → hooks/concepts/lifecycle.md                 (50 lines)
  → hooks/concepts/validation.md                (30 lines)

Total context loaded: ~200 lines
vs flat docs: ~4000 lines (DATABASE.md + API_ROUTES.md + HOOKS.md + TESTING.md)
```

### Index File Format

Each index file follows the same structure so agents can parse them mechanically:

```markdown
# API Routes

> Adding endpoints, controllers, route templates

## When You're Here
- Adding a new endpoint
- Modifying an existing route
- Adding middleware to routes

## Concepts

| Concept | File | When to Read |
|---------|------|-------------|
| Route Factory | `concepts/route-factory.md` | Creating any new route (ALWAYS read this first) |
| Schema Validation | `concepts/schema-validation.md` | Defining request/response schemas |
| Error Handling | `concepts/error-handling.md` | Custom error responses |
| Middleware | `concepts/middleware.md` | Auth, rate limiting, logging |
| Testing | `concepts/testing.md` | Writing route tests |

## Cross-References
- Schema changes? → `../database/`
- Hooks on mutations? → `../hooks/`
- Permission checks? → `../permissions/`
```

### Concept File Format

Each concept file is self-contained: pattern + example + anti-pattern.

```markdown
# Route Factory

> Use `createRouteConfig` for ALL routes. Never write raw Hono routes.

## Pattern

\`\`\`ts
const routes = createRouteConfig({
  schema: {
    params: z.object({ id: z.string() }),
    body: CreateProjectSchema,
  },
  handler: async (c) => {
    const { db } = getAppEnv(c);
    // ...
  },
});
\`\`\`

## Anti-Pattern

\`\`\`ts
// WRONG: raw Hono route
app.get("/projects/:id", async (c) => { ... });
\`\`\`

## Depends On
- `schema-validation.md` — for schema definitions
- `../hooks/lifecycle.md` — if the route triggers mutations
```

### Knowledge Tree in the Harness

The harness evaluates **both** the flat docs and the knowledge tree. They're separate system variants:

```
system-variants/
  flat-baseline/              # Current docs/claude/*.md approach
  tree-baseline/              # Same content, reorganized as knowledge tree
  tree-opus-optimized/        # Knowledge tree, optimized for Opus
  tree-sonnet-optimized/      # Knowledge tree, optimized for Sonnet
  tree-haiku-optimized/       # Knowledge tree, optimized for Haiku
```

The harness can answer: "Does the tree structure actually produce better scores than flat docs?" and "How much context does the agent load with tree vs flat?"

### Measuring Retrieval Efficiency

A new scoring dimension: **retrieval** — how efficiently did the agent find the information it needed?

```ts
interface RetrievalScore {
  totalContextLoaded: number;       // Lines of docs the agent read
  relevantContextLoaded: number;    // Lines that were actually useful
  efficiency: number;               // relevant / total (0-1)
  missedConcepts: string[];         // Concepts it should have read but didn't
  unnecessaryConcepts: string[];    // Concepts it read but didn't need
  hops: number;                     // How many index files it traversed
}
```

With flat docs, efficiency is typically 0.05-0.15 (agent loads everything, uses 5-15%). With the knowledge tree, target is 0.60+.

### Generating the Knowledge Tree from Flat Docs

The harness can **auto-generate** the knowledge tree from existing flat docs:

1. Parse each `docs/claude/*.md` into sections
2. Cluster sections by domain (most already map 1:1 to domains)
3. Split each section into self-contained concepts
4. Generate index files with concept listings and cross-references
5. Run fixtures against both flat and tree variants to validate

This means the knowledge tree doesn't require manual authoring — the Oracle can propose tree restructurings as part of the refinement loop, and the harness validates whether the restructuring actually improves retrieval efficiency.

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

## Package: `@template/prompt-harness`

This is its own package in the monorepo. It operates **on** other packages — it doesn't depend on them at runtime, it evaluates whether agents can correctly build with them.

```
packages/
  prompt-harness/              # @template/prompt-harness
    package.json
    tsconfig.json
    src/
      cli.ts                   # CLI entry point: `bun run harness <command>`
      mcp/                     # MCP servers (HIVEMIND integration)
        harness-server.ts      # run_fixture, evaluate, get_pattern_signatures
        ledger-server.ts       # get_history, add_entry, get_best, get_matrix
        worktree-server.ts     # create, capture_changes, apply_patch, cleanup
      agents/                  # Agent configurations
        subject.ts
        implementer.ts
        oracle.ts
        orchestrator.ts
      diagnostics/             # The two diagnostic modes
        basic.ts               # Quick sanity check
        age.ts                 # Drift detection over time
      loop/                    # Core refinement loop
        single-fixture.ts
        parallel.ts
        extraction.ts          # Signal decomposition + positive extraction
      eval/                    # Evaluation engine
        structural.ts
        pattern.ts
        semantic.ts
        stylistic.ts
        questioning.ts
        restraint.ts
        composite.ts
      ledger/                  # Run history management
        run-ledger.ts
        master-ledger.ts
        score-matrix.ts
      worktree/                # Git worktree lifecycle
        manager.ts
      report/                  # Report generation
        oracle-report.ts
        epoch-report.ts
        diagnostic-report.ts
    fixtures/                  # Test cases
      add-endpoint-simple/
      add-endpoint-medium/
      add-endpoint-complex/
      schema-change-simple/
      schema-change-complex/
      _self/                   # Dogfood fixture (see below)
    system-variants/           # Versioned doc snapshots
    results/                   # Run history + epoch data
```

### CLI

```bash
# Basic diagnostic — quick sanity check, runs simple fixtures
bun run harness diagnostic:basic

# Age diagnostic — how have scores drifted since last baseline?
bun run harness diagnostic:age

# Run a single fixture
bun run harness run add-endpoint-simple

# Run the full parallel suite
bun run harness run --parallel

# Start the refinement loop
bun run harness refine --max-epochs 10 --cost-ceiling 50

# Compare two doc variants
bun run harness compare baseline v2

# Dogfood — test the harness's own docs
bun run harness run _self
```

### Package JSON

```json
{
  "name": "@template/prompt-harness",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/cli.ts",
  "scripts": {
    "harness": "bun src/cli.ts",
    "diagnostic:basic": "bun src/cli.ts diagnostic:basic",
    "diagnostic:age": "bun src/cli.ts diagnostic:age",
    "test": "bun test"
  }
}
```

## Diagnostic Modes

Two modes for two questions. Basic asks "are the docs working?" Age asks "are the docs still working?"

### Basic Diagnostic

**When to run:** After any doc change. Before merging doc PRs. As a CI check.

**What it does:**
1. Runs all **simple** fixtures in parallel (fast, cheap)
2. Reports pass/fail per fixture with a brief score summary
3. Flags any fixture that dropped below threshold

This is the "does it still compile" equivalent for your docs. Fast, cheap, catches obvious regressions.

```ts
interface BasicDiagnostic {
  timestamp: string;
  variant: string;                // Which docs version
  fixtures: {
    name: string;
    tier: "simple";               // Only simple fixtures
    composite: number;
    passed: boolean;              // Above threshold?
    regressionFromLast: number;   // Delta from last basic diagnostic
  }[];
  summary: {
    passed: number;
    failed: number;
    avgComposite: number;
    recommendation: "ok" | "review" | "block";
  };
}
```

```bash
$ bun run harness diagnostic:basic

  BASIC DIAGNOSTIC — 2026-02-11

  add-endpoint-simple     0.92  PASS  (+0.02)
  schema-change-simple    0.88  PASS  (-0.01)
  add-permissions-simple  0.85  PASS  (+0.05)
  background-job-simple   0.91  PASS  (+0.00)

  4/4 passed | avg: 0.89 | recommendation: OK
```

### Age Diagnostic

**When to run:** Weekly. After major refactors. When onboarding patterns start to feel stale.

**What it does:**
1. Runs the **full fixture matrix** (simple + medium + complex) against the **current** docs
2. Compares scores to the **historical baseline** — the last known-good epoch
3. Detects **drift**: scores that have degraded over time even though docs haven't changed

Why do scores drift even when docs don't change? Because the **codebase** changes. New patterns get added, old patterns get refactored, examples in the docs reference code that's been moved. The docs are technically correct but practically stale.

```ts
interface AgeDiagnostic {
  timestamp: string;
  baselineEpoch: string;          // Which epoch we're comparing to
  currentVariant: string;
  drift: {
    fixture: string;
    tier: "simple" | "medium" | "complex";
    baseline: number;             // Score when docs were last tuned
    current: number;              // Score now
    delta: number;
    driftCause: "codebase_changed" | "pattern_evolved" | "unknown";
    details: string;              // Oracle's analysis of WHY it drifted
  }[];
  summary: {
    totalDrift: number;           // Sum of all negative deltas
    worstFixture: string;
    recommendation: "stable" | "tune_docs" | "new_fixtures_needed";
  };
}
```

```bash
$ bun run harness diagnostic:age

  AGE DIAGNOSTIC — 2026-02-11
  Baseline: epoch-012 (2026-01-15)

  SIMPLE TIER
  add-endpoint-simple     0.92 → 0.90  drift: -0.02  (stable)
  schema-change-simple    0.88 → 0.72  drift: -0.16  ⚠ DEGRADED

  MEDIUM TIER
  add-endpoint-medium     0.80 → 0.78  drift: -0.02  (stable)
  add-permissions         0.85 → 0.70  drift: -0.15  ⚠ DEGRADED

  COMPLEX TIER
  add-endpoint-complex    0.65 → 0.60  drift: -0.05  (stable)
  full-feature            0.55 → 0.40  drift: -0.15  ⚠ DEGRADED

  Worst drift: schema-change-simple (-0.16)
    Cause: Prisma schema was refactored since baseline. Docs reference
    old model utility patterns that no longer exist in the codebase.

  Recommendation: TUNE DOCS — 3 fixtures degraded significantly
```

The age diagnostic tells you **when your docs have gone stale** without anyone noticing. The codebase evolved, the docs didn't, and agents are silently getting worse.

## Dogfooding

The harness tests itself. Fixture `_self` evaluates whether the harness's own documentation is sufficient for an agent to understand and extend the harness.

### The `_self` Fixture

```
fixtures/
  _self/
    prompt.md              # "Add a new evaluation dimension to the harness"
    subject-context.md     # Domain knowledge about what the harness does
    golden/
      stage-1-skeleton/    # Correct file structure + type additions
      stage-2-core/        # Evaluation logic implemented
      stage-3-complete/    # Full implementation with tests
    eval.config.ts         # Pattern signatures for harness code
    expected-questions.md  # Questions about scoring weights, integration points
```

### What Dogfooding Tests

The `_self` fixture asks the Implementer to modify the harness itself. This tests:

1. **Can the agent understand this doc?** If the harness docs (this file + code comments) aren't clear enough for an agent to extend the harness, they're not clear enough for anything.
2. **Does the package structure make sense?** If the agent creates files in the wrong directories within the harness package, the structure is confusing.
3. **Are the TypeScript interfaces self-documenting?** The agent should be able to look at the interfaces and know what to implement.
4. **Meta-regression detection:** If a doc change to the harness's own docs makes the `_self` fixture regress, the change made the harness harder to understand — exactly the kind of thing it's designed to catch.

### Dogfood Tiers

| Tier | Fixture | What's Tested |
|------|---------|--------------|
| Simple | `_self/add-eval-dimension` | Add a new scoring dimension (e.g., "security") to the eval pipeline |
| Medium | `_self/add-fixture-type` | Add a new fixture tier (e.g., "integration") with its own scoring weights |
| Complex | `_self/add-diagnostic-mode` | Add a new diagnostic mode that cross-references with external data |

If the harness can't describe itself well enough for an agent to extend it, it has no business evaluating other docs.

## Implementation Phases

### Phase 1: Package Scaffold + Manual Baseline

- Create `packages/prompt-harness` with the package structure above
- Create 2-3 simple fixtures by hand from recently merged PRs
- Run the three agents manually (Subject, Implementer, Oracle)
- Oracle evaluates by hand, produces first report
- Establish baseline scores and initial run ledger

### Phase 2: Basic Diagnostic + Single-Fixture Loop

- Implement the basic diagnostic (simple fixtures only, quick feedback)
- Build the run ledger and Oracle report generation
- Automate the implement → evaluate → diagnose → prescribe → re-trigger cycle
- Add the `_self` dogfood fixture

### Phase 3: Age Diagnostic + Parallel Suite

- Implement age diagnostic (full matrix, drift detection)
- Add 5-8 fixtures across the complexity tiers
- Parallel execution with positive signal extraction
- System variant versioning: every Oracle patch creates a snapshot
- Cross-tier regression detection

### Phase 4: MCP Servers + Full Autonomy

- Expose harness, ledger, and worktree as MCP servers
- Claude can interact with the harness directly via MCP tools
- HIVEMIND integration for persistent state and cross-run intelligence
- Loop runs unattended: fixture suite → Oracle analysis → doc patch → re-run
- CI integration: basic diagnostic on doc changes, age diagnostic weekly

## Fixture Strategy & Maintenance

### Recommended Fixture Counts

The right number of fixtures balances coverage against cost. Too few and you have blind spots. Too many and each refinement epoch gets expensive. The sweet spot:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     FIXTURE PORTFOLIO                                │
│                                                                      │
│  SIMPLE (5-8 fixtures)                                              │
│  ├── Fast: ~2 min each, cheapest model tier                        │
│  ├── Run on every doc change (basic diagnostic)                     │
│  ├── Cover the breadth of patterns                                  │
│  │                                                                   │
│  │  add-endpoint-simple        (API routes, schema, controller)     │
│  │  schema-change-simple       (Prisma, model utilities)            │
│  │  add-permissions-simple     (Permix, roles, middleware)          │
│  │  background-job-simple      (BullMQ, cron, worker)              │
│  │  add-hook-simple            (Lifecycle hooks, validation)        │
│  │  frontend-component-simple  (React, routing, state)             │
│  │  add-test-simple            (Test patterns, factories)           │
│  │  add-email-simple           (Communications, templates)          │
│  │                                                                   │
│  MEDIUM (2-4 fixtures)                                               │
│  ├── Moderate: ~5-10 min each, middle cost                          │
│  ├── Run on parallel epochs + age diagnostic                        │
│  ├── Test pattern combinations and questioning behavior             │
│  │                                                                   │
│  │  add-endpoint-medium        (CRUD + custom actions + pagination) │
│  │  schema-with-hooks-medium   (Schema + hooks + cache)             │
│  │  permissions-job-medium     (Permissions + background processing)│
│  │                                                                   │
│  COMPLEX (1-2 fixtures)                                              │
│  ├── Slow: ~15-25 min each, highest cost                            │
│  ├── Run on age diagnostic + full refinement only                   │
│  ├── Test restraint, multi-system orchestration, judgment           │
│  │                                                                   │
│  │  full-feature-complex       (End-to-end: API + DB + hooks +     │
│  │                              permissions + jobs + frontend)      │
│  │  multi-resource-complex     (Cross-resource relationships,       │
│  │                              batch operations, auth)             │
│  │                                                                   │
│  DOGFOOD (1-2 fixtures)                                              │
│  ├── Self-referential: tests the harness's own docs                 │
│  │                                                                   │
│  │  _self/add-eval-dimension   (Simple: add scoring dimension)     │
│  │  _self/add-diagnostic-mode  (Complex: new diagnostic mode)      │
└──────────────────────────────────────────────────────────────────────┘
```

**Total: 9-16 fixtures.** Start with 6-8 (mostly simple) and grow organically.

#### Why This Distribution

- **Simple fixtures are your workhorse.** They're cheap, fast, and catch 80% of regressions. A handful covering the breadth of patterns (routes, schema, permissions, jobs, hooks, frontend) gives you a wide net. The basic diagnostic runs only these — you want it finishing in under 5 minutes.

- **Medium fixtures test the interesting stuff.** Pattern combinations, questioning quality, the transition from "just follow the template" to "make judgment calls." Two or three is enough — each one should exercise a *different* combination of systems. Don't duplicate what simples already cover.

- **Complex fixtures are guardrails, not workhorses.** They exist to prevent the simplification trap — docs that make easy things easy but lose nuance for hard things. One or two is sufficient because they're expensive and their primary value is detecting restraint regressions, not driving doc improvements. The Oracle should mostly be learning from simple/medium and using complex as a regression gate.

#### When to Add a New Fixture

Add a new fixture when:

1. **A new pattern is introduced.** New route template? New hook type? New background job pattern? Add a simple fixture covering it.
2. **A pattern combination keeps causing issues.** If agents consistently struggle with "schema change + hooks + cache" as a combined operation but handle each individually, that combination needs its own medium fixture.
3. **The age diagnostic flags persistent drift.** If a fixture's score keeps degrading despite doc updates, the golden implementation may be outdated or the fixture's scope may need to change.
4. **A real implementation reveals a gap.** When an agent produces notably good or bad output on a real task, that task is a candidate for a new fixture. Extract the prompt, capture the ideal output, write a fixture.

#### When to Retire a Fixture

Remove or replace a fixture when:

1. **The pattern it tests no longer exists.** If you deprecate a pattern, the fixture testing it is noise.
2. **It consistently scores 1.0 across all models.** It's not providing signal — the docs perfectly cover it. Keep one simple fixture as a smoke test, retire the rest.
3. **Its golden implementation has diverged from current patterns.** If updating the golden would change more than 30% of it, consider writing a new fixture from scratch rather than patching.

### Keeping Goldens Current

Golden implementations are the ground truth. When they go stale, the harness grades against outdated patterns and scores become meaningless.

#### The Staleness Problem

```
Week 1: Golden uses createRouteConfig v1 → agent output matches → score 0.95
Week 8: Team migrates to createRouteConfig v2 → agent output uses v2 → score 0.60
         The agent is actually correct. The golden is wrong.
```

#### Update Triggers

Golden implementations should be updated when:

| Trigger | What to Update | How |
|---------|---------------|-----|
| **Pattern change** (route factory API changes) | Golden files using that pattern | Extract from the PR that changed the pattern |
| **Schema refactor** (model renamed, field moved) | Any golden referencing the schema | Run `db:generate`, update golden to match |
| **New convention** (naming, imports, style) | All goldens that violate the new convention | Batch update — lint the goldens against new rules |
| **Codebase restructure** (directory moves) | Structural expectations in goldens | Update file paths in golden + eval.config.ts |
| **Age diagnostic flags drift** | The drifting fixture's golden | Investigate what changed in the codebase, update golden to match |

#### Practical Workflow: Golden Update Process

```
1. DETECT — Age diagnostic shows score drift on a fixture
2. INVESTIGATE — Oracle reports WHY the drift occurred
   "Agent used createRouteConfig v2, golden expects v1"
3. UPDATE GOLDEN — Pull the current pattern from the codebase
   - Find a recent merged PR using the pattern
   - Extract the relevant files
   - Replace golden/ directory (or the appropriate stage)
   - Update pattern signatures in eval.config.ts
4. RE-BASELINE — Run the fixture with the updated golden
   "New baseline: 0.91 (was 0.60 against stale golden)"
5. RECORD — Log the golden update in the fixture's changelog
```

#### Automating Golden Updates

Two approaches, used together:

**1. PR-triggered golden candidates.** When a PR merges that touches files matching a fixture's patterns, flag that fixture for review. Don't auto-update — flag for human verification.

```ts
// In CI: check if merged PR affects any fixture's domain
interface GoldenUpdateCandidate {
  fixture: string;
  reason: string;           // "PR #142 modified route factory"
  filesChanged: string[];   // Overlap between PR and fixture's golden
  confidence: "high" | "medium" | "low";
  action: "auto_update" | "human_review";
}
```

**2. Oracle-proposed golden updates.** During age diagnostics, the Oracle can propose specific golden updates when it detects the agent's output is *more correct* than the golden (because it follows newer patterns).

```
Oracle: "The agent's output uses createRouteConfig v2, which matches the
  current codebase. The golden still uses v1. Recommending golden update."
  Prescription type: fixture_update
  Target: fixtures/add-endpoint-simple/golden/
  Confidence: 0.90
```

### Keeping Pattern Examples Current

Pattern examples in docs and fixture prompts must reflect the actual codebase.

#### The Stale Example Problem

```markdown
## In docs/claude/API_ROUTES.md
\`\`\`ts
// Example from 6 months ago
const routes = createRouteConfig({
  schema: { params: ParamsSchema },
  handler: async (c) => {
    const env = getAppEnv(c);       // ← API changed: now getAppContext(c)
    const db = env.db;              // ← Changed: now env.services.db
\`\`\`
```

The example "compiles" in the doc but doesn't match the real codebase. The agent follows the example, produces code using the old API, and scores drop.

#### Keeping Examples Fresh

**1. Pin examples to real files.** Instead of writing standalone examples, reference actual code:

```markdown
## Route Factory Pattern
See: `apps/api/src/routes/organizations/index.ts` (lines 15-45)
```

The age diagnostic catches when the referenced file changes and the doc's description no longer matches.

**2. Pattern signature validation.** Each fixture's `eval.config.ts` contains regex patterns that represent the current conventions. When patterns change, the signatures need updating:

```ts
// eval.config.ts — update these when the pattern evolves
export const patternSignatures = [
  /createRouteConfig\(\{/,          // Route factory usage
  /getAppContext\(c\)/,              // Context getter (was getAppEnv)
  /c\.services\.db/,                // DB access path (was c.db)
];
```

**3. Fixture prompt review cadence.** Review fixture prompts quarterly or after major refactors. A prompt that was "appropriately vague" when written may now be confusing if the domain has shifted.

### Maintenance Calendar

| Frequency | Action | What's Involved |
|-----------|--------|----------------|
| **Every doc change** | Basic diagnostic | Auto: runs simple fixtures, ~5 min |
| **Weekly** | Age diagnostic | Auto: full matrix, ~30 min, flags drift |
| **Per major PR** | Check golden candidates | Semi-auto: CI flags, human reviews |
| **Monthly** | Review medium/complex goldens | Manual: verify goldens match current codebase |
| **Quarterly** | Full fixture audit | Manual: retire stale fixtures, add new ones, review prompts |
| **After major refactor** | Full re-baseline | Manual: update all goldens, re-run full suite, new baseline epoch |

### Cost Estimation

Rough costs per run (model-dependent, approximate):

| Run Type | Fixtures | Estimated Cost | Duration |
|----------|----------|---------------|----------|
| Basic diagnostic (simple only) | 5-8 | $2-5 | 5-10 min |
| Single fixture refinement (1 run) | 1 | $1-3 | 5-15 min |
| Parallel epoch (all fixtures) | 9-16 | $15-40 | 15-25 min |
| Full refinement loop (10 epochs) | 9-16 × 10 | $150-400 | 3-5 hours |
| Age diagnostic (full matrix) | 9-16 | $15-40 | 15-25 min |

The basic diagnostic is cheap enough for CI. The full refinement loop is an investment — run it when docs need meaningful tuning, not on every change.

## Open Questions

1. **Cost** — Each fixture run is a full agent session. Basic diagnostic should be cheap (simple fixtures only + Haiku/Sonnet). Full refinement loops are expensive. Budget per epoch?
2. **Determinism** — Same prompt can produce different output. How many runs per fixture to get statistical significance? 3 minimum, 5 ideal? Does the Oracle average across runs?
3. **Fixture Freshness** — The age diagnostic detects stale docs. But who updates the golden implementations when the codebase changes? Auto-generate from new PRs?
4. **Partial Credit** — An implementation that works but uses different patterns is... correct? wrong? The scoring weights encode your opinion here.
5. **Multi-Model** — Different models (Opus, Sonnet, Haiku) will score differently as Implementer. Track per-model or optimize for one?
6. **Subject Fidelity** — How realistic is a simulated domain expert? Should the Subject be seeded from actual Slack/issue conversations?
7. **Oracle Reliability** — The Oracle is itself an LLM. Can it reliably diagnose *why* a score changed? What if its prescriptions oscillate (patch A → revert A → patch A)?
8. **Dogfood Recursion** — If the `_self` fixture's docs are themselves tuned by the loop, does the system converge or oscillate? Is there a fixed-point?
9. **MCP Server Scope** — Which operations should be tools (callable by Claude) vs CLI commands (run by humans)? How much autonomy does Claude get?
