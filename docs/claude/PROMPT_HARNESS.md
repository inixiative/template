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

A fixture is a self-contained test case. The **prompt is deliberately terse** — one or two sentences, like a real stakeholder would give you in Slack:

```
fixtures/
  add-endpoint/
    prompt.md          # "We need a projects endpoint." (that's it)
    subject-context.md # Gated Q&A — Subject only reveals answers when asked
    golden/            # The known-good implementation
      apps/api/src/routes/projects/...
      packages/db/prisma/schema.prisma (diff)
      apps/api/src/routes/projects/__tests__/...
    assertions.ts      # Explicit checklist: every specific rule to verify
    eval.config.ts     # Evaluation criteria (scoring weights, overrides)
    expected-questions.md  # Questions a good agent SHOULD ask
```

The **prompt** is NOT a spec. It's what a product person would say: "We need a projects endpoint" or "Add soft-delete to organizations." The agent has to figure out what questions to ask. If the prompt gives too much away, it's testing "can the agent follow instructions" instead of "can the agent gather requirements and build correctly."

The **subject-context.md** is structured as Q&A pairs — the Subject only reveals a piece of knowledge when the Implementer asks a question that matches. The Subject doesn't volunteer information. This is the key eval signal: did the agent ask the right questions?

The **golden directory** contains the correct output — what a senior dev on your team would produce. This can be a full file tree or a set of diffs.

The **assertions file** is the precision backbone. Every fixture declares exactly what to check — "did it use the factory?", "are types inferred?", "did it set up dependencies correctly?" Each assertion is a concrete, mechanically-checkable rule.

### 2. Run the Agents

For each fixture, three agents collaborate with **isolated contexts**:

```
Orchestrator
  │
  ├─→ Implementer: "We need a projects endpoint."  (that's the whole prompt)
  │     │
  │     ├─→ [reads codebase, reads system docs]
  │     │
  │     ├─→ asks Subject: "What operations do we need? Full CRUD or read-only?"
  │     │     │
  │     │     └─→ Subject: "Full CRUD." (terse — doesn't elaborate)
  │     │
  │     ├─→ asks Subject: "Should deleting a project be a soft delete or hard delete?"
  │     │     │
  │     │     └─→ Subject: "Soft delete. We need them for audit trails."
  │     │
  │     ├─→ asks Subject: "Can a project name change after creation?"
  │     │     │
  │     │     └─→ Subject: "Yes, but unique within the org."
  │     │
  │     ├─→ (agent does NOT ask about permissions — misses a question)
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

#### 1. Subject (The Vague PM)

The Subject simulates the **stereotypical project manager** — someone who knows the requirements in their head but doesn't think to include the detail. They're not hostile or withholding. They genuinely believe "we need a projects endpoint" is a complete requirement. They have all the answers — they just don't know those are questions until you ask them.

Think: the PM who writes a one-line Jira ticket, not because they're lazy, but because to *them* the rest is obvious. When you ask "soft delete or hard delete?" they immediately know the answer — they just never thought to write it down.

**Behavior:**
- **Thinks their vague description is sufficient.** Doesn't understand why the developer needs more detail.
- **Answers happily when asked.** Not hostile — once you ask the right question, they know the answer immediately. "Oh yeah, soft delete, we need audit trails."
- **Doesn't connect the dots for you.** Knows permissions matter but won't mention them unless asked about access/roles specifically.
- **Gives high-level answers first.** "Full CRUD." If you want more detail, you have to ask a more specific follow-up.
- **Confused by implementation questions.** "Should I use a factory pattern?" → "I don't know what that means. Build it however you normally do."
- **Has opinions when prompted.** Not empty-headed — they have strong opinions on business rules. They just express them reactively, not proactively.

**Context provided (from subject-context.md):**
- Q&A pairs with trigger keywords — the Subject reveals an answer when the Implementer asks something that semantically matches
- A brief persona (who they are, their communication style)

**Context withheld:**
- The golden implementation (doesn't know the "right" code)
- System docs / CLAUDE.md (doesn't coach on patterns)
- Evaluation criteria (doesn't know how grading works)

```ts
// Subject agent definition
const subject: AgentConfig = {
  model: "sonnet",
  systemPrompt: `You are a project manager. You know what this feature should do
    but you don't think to include details unless asked. You gave the developer
    a brief description and you think that's enough.

    How to behave:
    - When they ask a question you have the answer to, give it naturally.
      Don't be cagey — you're helpful, just not proactive.
    - Keep answers conversational and brief. You're replying on Slack, not
      writing a spec. One or two sentences is normal.
    - If they ask something you don't have an answer for in your context,
      say "hmm, good question... I'd say [reasonable default]" or "let me
      think... [make a call]."
    - If they ask about code, libraries, patterns, or technical implementation,
      say "I don't know about that stuff, you're the developer" or "whatever
      you guys normally do is fine."
    - Don't use developer jargon. Say "the name has to be unique" not "add a
      unique constraint on the name column."
    - You can say "oh good point" or "I didn't think about that" — that's
      realistic. Real PMs have blind spots.`,
  context: fixture.subjectContext,   // Gated Q&A pairs
  tools: [],                         // No tools — pure conversation
};
```

**Why a vague PM?** Because that's the real test. The agent's job isn't just to follow instructions — it's to figure out what's *missing* from the instructions and go get it. A PM who writes a perfect spec tests "can the agent read." A vague PM tests "can the agent think." The questions the agent asks (and doesn't ask) are the strongest diagnostic signal the harness produces:

- Agent asks about delete behavior → good, it's thinking about data lifecycle
- Agent asks about permissions → good, it noticed the permission system in the codebase
- Agent doesn't ask about field types → bad, it guessed instead of clarifying
- Agent asks the PM about code patterns → bad, it should have read the docs

#### 2. Implementer (Code Writer)

The Implementer is the **agent under test** — the one whose output we're evaluating. This is the agent whose performance improves when your docs improve.

**Context provided:**
- System docs variant being tested (CLAUDE.md + docs/claude/*.md)
- The task prompt — deliberately vague, 1-2 sentences ("We need a projects endpoint.")
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

### Git Strategy: Fixture Branches

Everything lives in the repo. No external answer key, no separate golden repo. Each fixture is **three branches** — raw, subject, and after. The harness plugs into any repo: define fixture branches and go.

#### The Three Branches

Each fixture has three branches. Each agent sees exactly one — physical isolation, no credential tricks needed.

```
fixture/add-endpoint-simple/raw         ← IMPLEMENTER works here
├── apps/
│   └── api/src/routes/
│       └── organizations/  (exists)
├── packages/
│   └── db/prisma/schema.prisma
├── CLAUDE.md  (injected by orchestrator)
├── docs/claude/*.md  (injected)
└── (NO .harness/ — clean codebase, nothing to ignore)

fixture/add-endpoint-simple/subject     ← SUBJECT reads from here
├── (same codebase as raw)
└── .harness/
    ├── subject-context.md              ← Domain knowledge
    ├── prompt.md                       ← Task description (also given to Implementer)
    └── config.json                     ← Fixture metadata

fixture/add-endpoint-simple/after       ← ORACLE reads from here
├── apps/
│   └── api/src/routes/
│       ├── organizations/  (exists)
│       └── projects/                   ← THE GOLDEN IMPLEMENTATION
│           ├── index.ts
│           └── __tests__/
├── packages/
│   └── db/prisma/schema.prisma         (+ Project model)
└── .harness/
    ├── assertions.ts                   ← EVAL CHECKLIST
    ├── eval.config.ts                  ← SCORING WEIGHTS
    ├── expected-questions.md           ← Questions agent should ask
    ├── config.json                     ← Same fixture metadata
    └── dialogue-template.md
```

**Raw branch** — What the Implementer sees:
- The bare codebase at the starting point. Nothing extra. No `.harness/` directory — there's nothing to strip, nothing to tell the agent to ignore, nothing that could leak.
- System docs (CLAUDE.md + docs/claude/*.md) are **injected by the orchestrator** from the variant being tested.
- The task prompt is delivered by the orchestrator (read from the subject branch's `.harness/prompt.md`), not from a file in the worktree.

**Subject branch** — What the Subject agent reads:
- Same codebase as raw (the Subject doesn't need the golden)
- `.harness/subject-context.md` — the domain knowledge that lets the Subject answer questions
- `.harness/prompt.md` — the task description (Subject needs to understand what's being built to answer questions about it)
- `.harness/config.json` — fixture metadata

**After branch** — What the Oracle reads:
- The codebase WITH the golden implementation applied
- `.harness/assertions.ts` — every specific check to run
- `.harness/eval.config.ts` — scoring weights and pattern signatures
- `.harness/expected-questions.md` — questions the Implementer should have asked
- The golden diff is `git diff raw..after`

#### Why Three Branches (Not Two)

With two branches (before + after), the before branch had `.harness/` committed to it with `subject-context.md`, `prompt.md`, etc. This meant:
- The Implementer's worktree had `.harness/` in it. You either had to strip it, `.gitignore` it, or tell the agent to ignore it — all fragile.
- The Subject's domain knowledge and the Implementer's workspace were on the same branch. The Implementer could read `subject-context.md` and get answers without asking.

With three branches:
- **Raw is truly raw.** The Implementer's worktree is a clean codebase. Period. No harness metadata anywhere.
- **Subject context is isolated.** The Subject agent's knowledge lives on its own branch. The Implementer can't access it — different worktree, different branch.
- **After is for Oracle only.** Golden + assertions + eval config. Never touches the Implementer's workspace.
- **Each agent sees exactly one branch.** No scoping, no stripping, no "ignore this directory" instructions.

#### .harness/ Directory

Lives on `subject` and `after` branches only. Not on `raw`. Not on `main`:

```gitignore
# In .gitignore on main branch
.harness/
```

On subject/after branches, `.harness/` is committed. Clone the repo, checkout the branch, everything's there.

```ts
interface FixtureConfig {
  name: string;                    // "add-endpoint-simple"
  tier: "simple" | "medium" | "complex";
  rawBranch: string;               // "fixture/add-endpoint-simple/raw"
  subjectBranch: string;           // "fixture/add-endpoint-simple/subject"
  afterBranch: string;             // "fixture/add-endpoint-simple/after"
  model: "opus" | "sonnet" | "haiku";
  timeout: number;                 // Max Implementer duration (ms)
  createdAt: string;               // When fixture was extracted
  expiresAt: string;               // When to replace with fresh extraction (4-8 weeks)
  sourcePR?: number;               // PR this was extracted from (for re-extraction)
}
```

#### Branch Naming

```
fixture/{fixture-name}/raw        # Clean codebase — Implementer works here
fixture/{fixture-name}/subject    # Codebase + domain knowledge — Subject reads here
fixture/{fixture-name}/after      # Golden implementation + eval criteria — Oracle reads here
```

Flat. No nesting. Tier is encoded in the fixture name:
```
fixture/add-endpoint-simple/raw       /subject       /after
fixture/add-endpoint-medium/raw       /subject       /after
fixture/schema-hooks-complex/raw      /subject       /after
```

#### The Run Lifecycle

```
1. WORKTREE — Create from the RAW branch
   git worktree add /tmp/harness-{id} fixture/{name}/raw
   (Implementer's workspace — clean codebase, no .harness/)

2. INJECT DOCS — Overwrite CLAUDE.md + docs/claude/ with the system
   variant being tested (orchestrator controls which doc version the agent sees)

3. READ FIXTURE — Orchestrator reads from the SUBJECT branch
   git show fixture/{name}/subject:.harness/prompt.md
   git show fixture/{name}/subject:.harness/subject-context.md
   git show fixture/{name}/subject:.harness/config.json
   (These files are never in the Implementer's worktree)

4. SPAWN SUBJECT — With context from the subject branch
   Subject agent receives subject-context.md as its system context
   Runs in orchestrator process (lightweight, no separate worktree needed)

5. SPAWN IMPLEMENTER — In the raw worktree
   Receives: task prompt (from prompt.md) via orchestrator
   Sees: clean codebase + injected system docs
   No .harness/ anywhere in its filesystem

6. ROUTE Q&A — Implementer ↔ Subject through orchestrator
   All questions and answers logged (becomes the dialogue file)

7. CAPTURE OUTPUT — When Implementer finishes
   git diff of everything changed — the agent's total output

8. EVALUATE — Orchestrator reads from the AFTER branch separately
   git show fixture/{name}/after:.harness/assertions.ts
   git show fixture/{name}/after:.harness/eval.config.ts
   Diffs Implementer output against raw→after golden diff
   Runs after branch's tests against Implementer's code

9. RECORD — Results + dialogue stored in ledger

10. CLEANUP — Remove worktree
```

#### Implementer Isolation

The Implementer works in a worktree of the **raw** branch. The raw branch has no `.harness/` directory — there's nothing to leak. The subject and after branches are never in the Implementer's worktree. Three levels of protection:

**Level 1: Instruction-based (minimum viable)**
System prompt says don't access fixture branches. With the three-branch model this is already much safer — even if the agent looked at the raw branch's git history, there's no `.harness/` to find. The answers are on different branches entirely.

**Level 2: Worktree refspec restriction (recommended for local)**
```bash
cd /tmp/harness-{id}
git config remote.origin.fetch "+refs/heads/main:refs/remotes/origin/main"
# Only main is fetchable — subject and after branches aren't in the refspec
# Even if the agent runs git fetch, other fixture branches won't download
```

**Level 3: Container with shallow clone (strongest, for cloud)**
```bash
git clone --depth 1 --single-branch \
  --branch fixture/{name}/raw \
  <repo-url> /workspace
# The container only has the raw branch. Subject and after don't exist here.
```

Start with Level 2 locally. Move to Level 3 when deploying to cloud infrastructure.

### Dialogue Capture

Every fixture run produces a `dialogue.md` — a structured record of the Implementer↔Subject conversation. This gets stored with the run results. The Oracle uses it for Q&A scoring, and humans review it to verify the Subject didn't leak implementation details or hallucinate domain knowledge.

#### The Dialogue File

```markdown
# Dialogue: add-endpoint-simple / run-003

## Fixture
- Tier: simple
- Model: opus
- Timestamp: 2026-02-11T14:30:00Z
- System Variant: tree-opus-v4

## Conversation

### Q1 (Implementer → Subject)
> What operations does this endpoint need? Full CRUD or just read?

**Answer (Subject):**
> Full CRUD.

**Oracle Review:**
- Was expected: YES (matches expected-questions.md #1 — core scope)
- Subject stayed in character: YES (brief, didn't elaborate on what CRUD means here)

### Q2 (Implementer → Subject)
> Should deleting a project be a soft delete or hard delete?

**Answer (Subject):**
> Oh good question. Soft delete — we need them for audit trails.

**Oracle Review:**
- Was expected: YES (matches expected-questions.md #2 — delete behavior)
- Impacted output: YES (agent implemented soft delete based on this)
- Subject stayed in character: YES ("oh good question" = realistic PM who didn't think of it)

### Q3 (Implementer → Subject)
> Should I use createRouteConfig or raw Hono routes?

**Answer (Subject):**
> I don't know what those are. Build it however you guys normally do.

**Oracle Review:**
- Was expected: NO (implementation question — PM can't answer this)
- Subject stayed in character: YES (correctly confused by technical jargon)
- **FLAG: Agent asked PM about code patterns instead of reading docs.
  This is a doc signal — docs don't clearly convey route factory as standard.**

## Summary
- Questions asked: 3
- Expected questions matched: 2/6 (missed: permissions, field types, name uniqueness, status enum)
- Wasteful questions: 1 (Q3 — PM can't answer implementation questions)
- Subject character breaks: 0
- **Key gap: Agent never asked about permissions. Built the endpoint
  without any access control. The PM knows "only admins can create"
  but was never asked.**
```

This dialogue file is the **evidence trail**. A reviewer can see exactly what information the agent received, whether the Subject stayed honest, and whether the conversation influenced the output. If the Oracle's score seems wrong, the dialogue is the first place to check.

### Fixture Authoring: One Interview, Two Outputs

Creating a fixture's Subject knowledge and Oracle checklist is the **same process**. You sit down, an agent plays the Implementer role and asks you questions about a feature you recently built, and the conversation produces both files:

- **subject-context.md** — the Q&A pairs become the Subject's gated knowledge
- **expected-questions.md** — the questions the agent asked become the checklist of questions a good Implementer should ask during eval runs

One interview, two outputs. The Oracle's "did the agent ask the right questions?" checklist is directly derived from the questions that surfaced during authoring. No separate authoring step for each.

#### The Authoring Session

```bash
bun run harness author add-endpoint-simple
```

```
1. YOU SIT DOWN — You recently built this feature. You know the decisions.

2. AGENT PLAYS IMPLEMENTER — It asks you questions, just like the real
   Implementer will ask the Subject during eval:

   Agent: "What operations does this endpoint need?"
   You:   "Full CRUD."
   Agent: "Should delete be soft or hard?"
   You:   "Soft delete. Audit trail."
   Agent: "Who can create projects?"
   You:   "Only org admins."
   Agent: "Can project names change after creation?"
   You:   "Yes, but unique within the org."
   Agent: "What about permissions for viewing vs editing?"
   You:   "Members can view, admins can edit and delete."
   Agent: "Any fields besides name?"
   You:   "Name, description (optional), status enum: active/archived."

3. CONVERSATION ENDS — Agent runs out of questions or you say "that's it"

4. AUTO-GENERATE — The harness produces two files from the transcript:

   subject-context.md:
   ┌─────────────────────────────────────────────────────┐
   │ role: "Product lead for the organizations team"     │
   │                                                     │
   │ qa:                                                 │
   │   - q: "What operations?"                           │
   │     a: "Full CRUD."                                 │
   │     category: core                                  │
   │   - q: "Soft or hard delete?"                       │
   │     a: "Soft delete. Audit trail."                  │
   │     category: core                                  │
   │   - q: "Who can create?"                            │
   │     a: "Only org admins."                           │
   │     category: permissions                           │
   │   - q: "Can names change?"                          │
   │     a: "Yes, but unique within the org."            │
   │     category: business_rule                         │
   │   - q: "Permissions for viewing vs editing?"        │
   │     a: "Members can view, admins can edit/delete."  │
   │     category: permissions                           │
   │   - q: "Fields besides name?"                       │
   │     a: "Name, description (optional), status enum:  │
   │        active/archived."                            │
   │     category: core                                  │
   └─────────────────────────────────────────────────────┘

   expected-questions.md:
   ┌─────────────────────────────────────────────────────┐
   │ # Expected Questions                                │
   │                                                     │
   │ ## Core (agent should always ask these)             │
   │ 1. What operations/scope (CRUD? read-only?)        │
   │ 2. Delete behavior (soft/hard)                     │
   │ 3. Data model fields                               │
   │                                                     │
   │ ## Permissions (agent should ask if docs mention    │
   │    the permission system)                           │
   │ 4. Who can create                                  │
   │ 5. View vs edit permissions                        │
   │                                                     │
   │ ## Business Rules (bonus — shows thoroughness)     │
   │ 6. Name mutability + uniqueness constraints        │
   └─────────────────────────────────────────────────────┘

5. YOU REVIEW — Add anything the agent didn't think to ask.
   Remove any implementation details that leaked in.
   Subject knows WHAT, never HOW.

6. COMMIT — Both files go to the subject branch (.harness/)
   expected-questions.md ALSO goes to the after branch (.harness/)
```

The authoring agent asks questions the same way the Implementer will during eval. If the authoring agent didn't think to ask something, the Implementer probably won't either — but if it's important, you add it manually during review. That gap is itself useful signal: questions you had to add manually are the ones the docs should be prompting the agent to ask.

#### subject-context.md as Gated Q&A

The Subject doesn't get a knowledge dump. It gets Q&A pairs, and its system prompt tells it to only reveal answers when a matching question is asked:

```yaml
# .harness/subject-context.md

role: "Product lead for the organizations team. Busy, terse, answers
       only what's asked. Doesn't elaborate unless pressed."

qa:
  - q: "What operations does this endpoint need?"
    a: "Full CRUD."
    category: core
    reveal_on: ["CRUD", "operations", "what does it do", "endpoints", "scope"]

  - q: "Should delete be soft or hard?"
    a: "Soft delete. Audit trail."
    category: core
    reveal_on: ["delete", "remove", "soft", "hard", "archive"]

  - q: "Who can create projects?"
    a: "Only org admins."
    category: permissions
    reveal_on: ["who can", "permissions", "create", "access", "roles"]

  - q: "Can project names change after creation?"
    a: "Yes, but unique within the org."
    category: business_rule
    reveal_on: ["rename", "change name", "update name", "mutable", "unique"]

  - q: "View vs edit permissions?"
    a: "Members can view, admins can edit and delete."
    category: permissions
    reveal_on: ["view", "edit", "read", "write", "member", "admin"]

  - q: "What fields besides name?"
    a: "Name, description (optional), status enum: active/archived."
    category: core
    reveal_on: ["fields", "columns", "schema", "properties", "attributes"]
```

The `reveal_on` keywords help the Subject match incoming questions to stored answers. If the Implementer asks "what's the data model look like?" the Subject matches on "fields"/"schema" and reveals the answer about name/description/status. If the Implementer never asks about permissions, the Subject never mentions them — and the Oracle scores that as a missed question.

**The Subject is a locked box with keyed slots.** Each question is a key. The knowledge is inside. The Implementer has to bring the right keys.

### Fixture Bootstrapping from Real PRs

The fastest way to create fixtures: extract them from merged PRs. A PR is already a before/after pair.

#### The Extraction Script

```bash
# Point the harness at a merged PR and generate fixture branches
bun run harness create-fixture \
  --from-pr 142 \
  --name add-endpoint-simple \
  --tier simple
```

What this does:

```
1. FIND COMMITS — Locate the merge commit and its parent
   Raw = parent of merge commit (state before the PR)
   After = merge commit (state after the PR)

2. CREATE THREE BRANCHES
   git branch fixture/add-endpoint-simple/raw <parent-sha>      # Clean codebase
   git branch fixture/add-endpoint-simple/subject <parent-sha>  # Same base + .harness/
   git branch fixture/add-endpoint-simple/after <merge-sha>     # Golden + .harness/

3. GENERATE SCAFFOLDING on the subject branch
   .harness/config.json — pre-filled with name, tier, default timeout
   .harness/prompt.md — DRAFT from PR title + description (needs human review)
   .harness/subject-context.md — EMPTY (human fills via authoring interview)

4. GENERATE EVAL CRITERIA on the after branch
   .harness/assertions.ts — DRAFT: each changed file becomes a structural
     assertion, each new import becomes a dependency assertion
   .harness/eval.config.ts — default weights for the tier
   .harness/expected-questions.md — EMPTY (human fills after authoring)

5. REPORT — Show what was generated and what needs human input
   "Created fixture branches. The following need manual completion:
    - subject-context.md (run: bun run harness author-context add-endpoint-simple)
    - Review generated assertions.ts (27 auto-generated, likely needs tuning)
    - expected-questions.md (fill after subject context authoring)"
```

The script does the mechanical work. The human provides the domain knowledge (subject context) and reviews the generated assertions. The agent-assisted authoring interview fills in subject-context.md interactively.

#### Fixture Expiration & Rotation

Fixtures have a TTL. Don't rebase them — replace them.

**Why not rebase?** Rebasing fixture branches onto main is fragile. One bad conflict resolution and the raw branch has after-branch content baked in, silently invalidating the fixture. Even if the rebase goes clean, a fixture from two months ago tests against patterns the team may no longer use. And rebasing requires someone to understand both the fixture's intent AND the codebase changes across three branches — that's a lot of context to hold.

**The rotation model:**

```
FIXTURE LIFECYCLE

  Created ──────────────── Active ──────────────── Expired
  (extracted from PR)      (running in diagnostics) (replaced by fresh extraction)
       │                        │                        │
       │  TTL: 4-8 weeks        │  Age diagnostic        │  Extract new fixture
       │  (simple: 8 weeks)     │  flags score drift     │  from recent PR covering
       │  (medium: 6 weeks)     │                        │  the same pattern
       │  (complex: 4 weeks)    │                        │
       └────────────────────────┴────────────────────────┘
```

When a fixture expires:

```bash
# Check what's expired
bun run harness check-expired

# Output:
# EXPIRED (age > TTL):
#   fixture/add-endpoint-simple — created 2025-12-01, expired 2026-01-26
#     Source PR: #142. Recent PRs with same pattern: #198, #215
#   fixture/schema-hooks-complex — created 2025-11-15, expired 2026-01-10
#     Source PR: #98. Recent PRs with same pattern: #201

# Replace with fresh extraction
bun run harness create-fixture --from-pr 215 --name add-endpoint-simple --tier simple
# Old branches are archived (renamed to archive/...) not deleted
```

**Why expiration beats maintenance:**

1. **No cross-contamination risk.** No rebase = no chance of leaking after-branch content into before.
2. **Always current.** Fresh fixtures extracted from recent PRs reflect current patterns, naming, imports, and conventions. No "technically correct but practically stale" fixtures.
3. **Lower cognitive load.** "Extract a new fixture from a recent PR" is a 10-minute mechanical task. "Rebase a fixture while understanding its original intent and resolving conflicts correctly" is error-prone judgment work.
4. **Natural pruning.** If there's no recent PR exercising a pattern, maybe that pattern doesn't need a fixture anymore. Expiration forces you to confront whether a fixture is still relevant.
5. **The assertions stay honest.** Fresh extraction means assertions.ts is generated from a real, working implementation — not patched to match a codebase that moved under it.

**Proactive drift check** — for between-expiration monitoring:

```bash
# After changing docs, check which active fixtures reference affected patterns
bun run harness check-drift

# Output:
# PATTERN CHANGED: getAppEnv → getAppContext (in docs/claude/CONTEXT.md)
# AFFECTED FIXTURES:
#   fixture/add-endpoint-simple/after — assertions.ts line 42 (expires in 3 weeks)
#   fixture/add-endpoint-medium/after — assertions.ts lines 38, 67 (expires in 1 week)
#
# RECOMMENDATION: fixture/add-endpoint-medium expires soon — let it expire naturally.
# fixture/add-endpoint-simple has 3 weeks left — consider early rotation.
```

The drift check tells you whether to wait for natural expiration or rotate early. Small pattern renames close to expiration? Let it expire. Fundamental API change? Rotate now.

### Infrastructure & Deployment

The harness supports three deployment tiers: local, single-server, and distributed cloud.

#### Deployment Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1: LOCAL                                                       │
│  Your laptop. Git worktrees, no containers.                         │
│                                                                      │
│  Orchestrator: local process                                        │
│  Implementers: git worktrees with refspec restriction (Level 2)     │
│  Parallelism: 2-3 concurrent (limited by memory + API rate)         │
│  Cost: API calls only                                               │
│  Use for: fixture authoring, basic diagnostic, single-fixture runs  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  TIER 2: SINGLE SERVER (Digital Ocean Droplet / EC2)                │
│  One server running containerized fixtures.                         │
│                                                                      │
│  Orchestrator: persistent container (always running)                │
│  Implementers: containers with shallow clones (Level 3 isolation)   │
│  Oracle: runs in orchestrator context (has after branch access)     │
│  Parallelism: 4-8 concurrent (server resources)                     │
│  Cost: $20-80/mo server + API calls                                 │
│  Use for: parallel epochs, full refinement loops, age diagnostics   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  TIER 3: DISTRIBUTED (Multiple Droplets)                            │
│  N servers, each running fixtures independently.                    │
│                                                                      │
│  Orchestrator: dedicated droplet                                    │
│  Implementers: one container per droplet per fixture                │
│  Results: flow back via HIVEMIND events                             │
│  Parallelism: N (one fixture per droplet, scale horizontally)       │
│  Cost: N × $10-20/mo + API calls                                    │
│  Use for: multi-codebase eval, multi-model sweeps, full parallelism │
└─────────────────────────────────────────────────────────────────────┘
```

#### Container Architecture

Each Implementer runs in its own container with a shallow clone of the **raw** branch. The container has everything the agent needs and nothing it shouldn't see — no `.harness/`, no subject context, no golden.

```bash
#!/bin/bash
# entrypoint.sh — parameterized per fixture run

# Shallow clone of ONLY the raw branch (strongest isolation)
# No .harness/ directory exists on this branch at all
git clone --depth 1 --single-branch \
  --branch "${FIXTURE_RAW_BRANCH}" \
  "${REPO_URL}" /workspace

cd /workspace

# Inject the system variant docs (overwrite whatever's on the branch)
cp -r /mnt/system-variant/CLAUDE.md .
cp -r /mnt/system-variant/docs/claude/ docs/claude/

# Install dependencies
bun install

# Start Claude session with the fixture prompt
# Prompt is passed by orchestrator (read from subject branch, not in this container)
# Orchestrator communicates via HIVEMIND events
claude --system-prompt "${TASK_PROMPT}" \
       --mcp-server hivemind \
       --dangerously-skip-permissions
```

The subject and after branches are **never cloned into Implementer containers.** The orchestrator reads subject context from the subject branch (via `git show`) and passes the task prompt to the container as an environment variable. Oracle evaluation reads the after branch orchestrator-side.

#### Docker Compose for Single Server

```yaml
services:
  orchestrator:
    build: ./packages/prompt-harness
    volumes:
      - harness-data:/data
      - /var/run/docker.sock:/var/run/docker.sock  # Spawns containers
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - HIVEMIND_DB_PATH=/data/hivemind.db
      - REPO_URL=${REPO_URL}

  # Implementer containers spawned dynamically by orchestrator via Docker API
volumes:
  harness-data:
```

The orchestrator uses a work queue to manage concurrent containers:

```
1. Enqueue all fixtures for this epoch
2. Pop fixture from queue
3. If under maxConcurrent: spawn Implementer container
4. When Implementer finishes: run Oracle evaluation (parallel with next Implementer)
5. When Oracle finishes: record results, destroy container
6. Repeat until queue empty
7. All results collected → Oracle meta-analysis (signal extraction)
```

Pipeline parallelism: Implementer N+1 starts while Oracle N evaluates.

#### Scaling to Multiple Codebases

The harness is repo-agnostic. Point it at any repo with fixture branches:

```bash
# Run diagnostics across multiple repos
bun run harness diagnostic:basic --repo template
bun run harness diagnostic:basic --repo zealot-monorepo
bun run harness diagnostic:basic --repo organized-play
```

Each repo has its own fixture branches, its own system docs, its own eval criteria. The orchestrator treats them as independent targets. Cross-codebase analysis: "this doc pattern works in repo A but not B — what's different about B's patterns?"

### Session Management

#### Watchdog / Session Health

Long-running agent sessions can stall, hit token limits, or crash:

```ts
interface WatchdogConfig {
  stallThreshold: number;         // No activity for N seconds → stalled
  maxDuration: {
    implementer: number;          // 15 min simple, 30 min complex
    oracle: number;               // 10 min
    subject: number;              // 5 min per question
  };
  onStall: "warn" | "restart" | "kill";
  onTimeout: "capture_partial" | "kill";
  healthCheckInterval: number;
}
```

**On failure:** always capture partial output. Oracle evaluates whatever was produced — even nothing is a data point. Partial results are more useful than a retry that might hit the same wall.

#### HIVEMIND Event Flow

All agent coordination flows through HIVEMIND events:

```
Orchestrator:
  hivemind_emit type=fixture_start fixture=add-endpoint-simple run=003

Implementer (in container, connected to HIVEMIND via MCP):
  hivemind_emit type=question target=subject content="Soft or hard delete?"
  hivemind_query type=answer source=subject  # Blocks until Subject responds

Subject (in orchestrator context):
  hivemind_query type=question target=subject  # Polls for questions
  hivemind_emit type=answer target=implementer content="Soft delete."

Implementer:
  hivemind_emit type=implementation_complete run=003

Oracle (in orchestrator context — has after branch access):
  hivemind_emit type=evaluation_complete run=003 scores={...}
  hivemind_emit type=diagnosis run=003 diagnosis={...}
  hivemind_emit type=prescription run=003 prescription={...}
```

The event log IS the run ledger. Every event has a timestamp, agent ID, and fixture context. The ledger is reconstructed from events rather than being a separate data store.

## Evaluation Detail

### Fixture Assertions (The Checklist)

Every fixture includes an `assertions.ts` file — an explicit, enumerated list of **every specific thing to check.** This is not fuzzy. Each assertion is a concrete yes/no question about the agent's output. The Oracle uses these as the primary scoring backbone, then layers its own analysis on top.

The assertions file is what makes scores *actionable*. Instead of "pattern score: 0.7" (which tells you nothing), you get "pattern score: 0.7 — FAILED: did not use createRouteConfig, FAILED: used raw db import instead of getAppEnv, PASSED: correct schema validation."

#### Assertion Types

```ts
// assertions.ts — every rule this fixture checks

interface Assertion {
  id: string;                    // Unique, stable identifier
  description: string;           // Human-readable: "Used createRouteConfig factory"
  category: AssertionCategory;   // Which scoring dimension this feeds into
  weight: number;                // How much this assertion matters (0-1)
  check: AssertionCheck;         // How to verify it
  tier: "required" | "expected" | "bonus";  // How severely to penalize failure
}

type AssertionCategory =
  | "structural"     // File/directory existence and placement
  | "pattern"        // Correct pattern usage
  | "semantic"       // Behavioral correctness
  | "stylistic"      // Naming, imports, formatting
  | "dependency"     // Correct wiring between modules
  | "type-safety"    // TypeScript types, inference, generics
  | "testing"        // Test structure and coverage
  | "restraint";     // Correctly scoped, didn't overreach

type AssertionCheck =
  | { type: "file_exists"; path: string }
  | { type: "file_not_exists"; path: string }
  | { type: "file_contains"; path: string; pattern: RegExp }
  | { type: "file_not_contains"; path: string; pattern: RegExp }
  | { type: "file_matches_golden"; path: string; tolerance: "exact" | "structural" | "semantic" }
  | { type: "test_passes"; testFile: string }
  | { type: "import_from"; file: string; module: string }
  | { type: "no_import_from"; file: string; module: string }
  | { type: "export_exists"; file: string; name: string }
  | { type: "type_inferred"; file: string; pattern: RegExp }   // No explicit type annotation
  | { type: "type_explicit"; file: string; pattern: RegExp }   // Has explicit type annotation
  | { type: "ast_match"; file: string; query: string }         // AST pattern (ts-morph)
  | { type: "custom"; fn: (output: AgentOutput) => AssertionResult };
```

#### Example: `add-endpoint-simple/assertions.ts`

```ts
import { Assertion } from "@template/prompt-harness";

export const assertions: Assertion[] = [
  // ── STRUCTURAL: correct files in correct places ──────────────────

  {
    id: "struct-route-file",
    description: "Created route file at correct path",
    category: "structural",
    weight: 1.0,
    tier: "required",
    check: { type: "file_exists", path: "apps/api/src/routes/projects/index.ts" },
  },
  {
    id: "struct-test-file",
    description: "Created test file at correct path",
    category: "structural",
    weight: 0.8,
    tier: "expected",
    check: { type: "file_exists", path: "apps/api/src/routes/projects/__tests__/projects.test.ts" },
  },
  {
    id: "struct-no-random-files",
    description: "Did not create files outside expected directories",
    category: "structural",
    weight: 0.5,
    tier: "expected",
    check: { type: "custom", fn: (output) => {
      const unexpected = output.createdFiles.filter(f =>
        !f.startsWith("apps/api/src/routes/projects/") &&
        !f.startsWith("packages/db/prisma/")
      );
      return { passed: unexpected.length === 0, details: unexpected };
    }},
  },

  // ── PATTERN: used the right patterns ─────────────────────────────

  {
    id: "pat-route-factory",
    description: "Used createRouteConfig factory (not raw Hono routes)",
    category: "pattern",
    weight: 1.0,
    tier: "required",
    check: { type: "file_contains", path: "apps/api/src/routes/projects/index.ts", pattern: /createRouteConfig\(\{/ },
  },
  {
    id: "pat-no-raw-routes",
    description: "Did NOT use raw app.get/app.post patterns",
    category: "pattern",
    weight: 0.8,
    tier: "required",
    check: { type: "file_not_contains", path: "apps/api/src/routes/projects/index.ts", pattern: /app\.(get|post|put|patch|delete)\(/ },
  },
  {
    id: "pat-context-getter",
    description: "Used getAppEnv(c) to access context",
    category: "pattern",
    weight: 0.9,
    tier: "required",
    check: { type: "file_contains", path: "apps/api/src/routes/projects/index.ts", pattern: /getAppEnv\(c\)/ },
  },
  {
    id: "pat-schema-validation",
    description: "Defined Zod schemas for request validation",
    category: "pattern",
    weight: 0.8,
    tier: "expected",
    check: { type: "file_contains", path: "apps/api/src/routes/projects/index.ts", pattern: /schema:\s*\{/ },
  },
  {
    id: "pat-prisma-import",
    description: "Imported from @template/db (not raw prisma client)",
    category: "pattern",
    weight: 0.7,
    tier: "expected",
    check: { type: "import_from", file: "apps/api/src/routes/projects/index.ts", module: "@template/db" },
  },

  // ── DEPENDENCY: correct wiring ───────────────────────────────────

  {
    id: "dep-db-via-context",
    description: "Accesses database through context, not direct import",
    category: "dependency",
    weight: 0.9,
    tier: "required",
    check: { type: "no_import_from", file: "apps/api/src/routes/projects/index.ts", module: "@prisma/client" },
  },
  {
    id: "dep-inferred-types",
    description: "Let Prisma types be inferred (no manual type for query results)",
    category: "type-safety",
    weight: 0.6,
    tier: "expected",
    check: { type: "type_inferred", file: "apps/api/src/routes/projects/index.ts", pattern: /const (projects?|result)\s*=\s*await/ },
  },
  {
    id: "dep-zod-from-generated",
    description: "Used generated Zod schemas (from db:generate) not hand-written",
    category: "dependency",
    weight: 0.7,
    tier: "bonus",
    check: { type: "import_from", file: "apps/api/src/routes/projects/index.ts", module: "@template/db/zod" },
  },

  // ── TYPE-SAFETY: TypeScript usage ────────────────────────────────

  {
    id: "type-no-any",
    description: "No `any` types in implementation",
    category: "type-safety",
    weight: 0.5,
    tier: "expected",
    check: { type: "file_not_contains", path: "apps/api/src/routes/projects/index.ts", pattern: /:\s*any\b/ },
  },
  {
    id: "type-response-types",
    description: "Response types match schema definitions",
    category: "type-safety",
    weight: 0.4,
    tier: "bonus",
    check: { type: "custom", fn: (output) => {
      // Check that response shapes match defined Zod schemas
      return { passed: true, details: "TODO: implement response type validation" };
    }},
  },

  // ── SEMANTIC: behavioral correctness ─────────────────────────────

  {
    id: "sem-crud-operations",
    description: "All 5 CRUD operations implemented (list, get, create, update, delete)",
    category: "semantic",
    weight: 1.0,
    tier: "required",
    check: { type: "custom", fn: (output) => {
      const content = output.fileContents["apps/api/src/routes/projects/index.ts"];
      const ops = ["GET /", "GET /:id", "POST /", "PATCH /:id", "DELETE /:id"];
      // Simplified — real check would parse route definitions
      return { passed: ops.length === 5, details: ops };
    }},
  },
  {
    id: "sem-tests-pass",
    description: "Golden test suite passes against agent's implementation",
    category: "semantic",
    weight: 1.0,
    tier: "required",
    check: { type: "test_passes", testFile: "apps/api/src/routes/projects/__tests__/projects.test.ts" },
  },

  // ── STYLISTIC: naming, imports, formatting ───────────────────────

  {
    id: "style-hash-imports",
    description: "Uses #/ path alias for internal imports",
    category: "stylistic",
    weight: 0.5,
    tier: "expected",
    check: { type: "file_contains", path: "apps/api/src/routes/projects/index.ts", pattern: /from\s+['"]#\// },
  },
  {
    id: "style-naming",
    description: "Route handlers follow naming convention",
    category: "stylistic",
    weight: 0.4,
    tier: "bonus",
    check: { type: "file_contains", path: "apps/api/src/routes/projects/index.ts", pattern: /(list|get|create|update|delete)Project/ },
  },

  // ── TESTING: test structure ──────────────────────────────────────

  {
    id: "test-describe-block",
    description: "Test uses describe block with fixture name",
    category: "testing",
    weight: 0.6,
    tier: "expected",
    check: { type: "file_contains", path: "apps/api/src/routes/projects/__tests__/projects.test.ts", pattern: /describe\(["'].*[Pp]roject/ },
  },
  {
    id: "test-factory-usage",
    description: "Tests use factory helpers (not inline data)",
    category: "testing",
    weight: 0.5,
    tier: "bonus",
    check: { type: "file_contains", path: "apps/api/src/routes/projects/__tests__/projects.test.ts", pattern: /factory|create.*Fixture|seed/ },
  },
];
```

#### Assertion Tiers

Assertions are tagged with severity tiers that affect how failures are scored:

| Tier | Meaning | Failure Impact |
|------|---------|---------------|
| **required** | Non-negotiable. The agent MUST do this. | Score floors at 0.3 if any required assertion fails |
| **expected** | Should do this. Missing it is a notable gap. | Each failure reduces category score proportionally |
| **bonus** | Nice to have. Shows deep pattern understanding. | Only adds to score, never penalizes |

This means an agent that hits all `required` assertions but misses every `bonus` might score 0.75 — solid but not perfect. An agent that nails everything including bonus items scores 0.95+. An agent that misses a `required` is immediately capped.

#### How Assertions Feed Scoring

```ts
interface AssertionResult {
  id: string;
  passed: boolean;
  details?: any;           // Extra context (e.g., which unexpected files)
}

interface AssertionReport {
  fixture: string;
  totalAssertions: number;
  results: AssertionResult[];
  byCategory: Record<AssertionCategory, {
    total: number;
    passed: number;
    failed: string[];       // IDs of failed assertions
    score: number;           // Weighted pass rate (0-1)
  }>;
  requiredFailures: string[];  // Any required assertion that failed
  composite: number;            // Overall score from assertions alone
}
```

The Oracle receives the `AssertionReport` as structured input — not just "pattern score: 0.7" but the full breakdown of exactly which assertions passed and failed. This makes its diagnosis precise:

```markdown
## Oracle Diagnosis (assertion-informed)

Pattern score: 0.70 (7/10 assertions passed)
  PASSED: pat-route-factory — Used createRouteConfig ✓
  PASSED: pat-schema-validation — Defined Zod schemas ✓
  PASSED: pat-prisma-import — Imported from @template/db ✓
  FAILED: pat-no-raw-routes — Found app.post() on line 42
  FAILED: pat-context-getter — Used direct db import instead of getAppEnv
  FAILED: dep-db-via-context — Imported @prisma/client directly

Root cause: Agent used createRouteConfig for GET routes but fell back to
raw Hono patterns for POST/PATCH/DELETE. The docs show createRouteConfig
examples only for GET — need examples for mutation routes.

Prescription: Add POST/PATCH/DELETE examples to API_ROUTES.md route factory section.
```

Without the assertion checklist, the Oracle would say "pattern score dropped" and have to figure out *what* specifically failed by diffing code. With assertions, the failure is already identified — the Oracle just needs to diagnose *why* and prescribe a fix.

#### Writing Good Assertions

Guidelines for writing assertions that produce useful signal:

1. **Be specific about the positive pattern.** "Used createRouteConfig" is checkable. "Used good patterns" is not.
2. **Check for anti-patterns explicitly.** Don't just check that the right thing exists — check that the wrong thing doesn't. `file_not_contains: app.get(` catches agents that fall back to raw routes.
3. **Cover the dependency chain.** It's not enough that the route file is correct — check that it imports from the right places, uses context correctly, and doesn't create tight coupling.
4. **Include type-safety checks.** Did the agent let types be inferred where they should be? Did it add explicit types where inference wouldn't work? Did it avoid `any`?
5. **Check what's NOT there.** Restraint assertions are "the agent did NOT create files outside the expected scope" or "did NOT add unnecessary dependencies."
6. **Each assertion should be independently meaningful.** If assertion A failing always means B fails too, they're testing the same thing — merge them.
7. **Weight by importance.** The route factory usage is weight 1.0. Import style is weight 0.4. Not everything matters equally.

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

**Note:** Pattern signatures are the lightweight version of assertions. For fixtures that don't need a full `assertions.ts`, pattern signatures in `eval.config.ts` are sufficient. For fixtures where you want precision, use the full assertion spec — each assertion replaces one or more pattern signatures with richer checking.

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
3. **The age diagnostic flags persistent drift.** Score keeps degrading despite doc updates → the fixture is stale. Rotate it from a recent PR rather than patching the after branch.
4. **A real implementation reveals a gap.** When an agent produces notably good or bad output on a real task, that task is a candidate for a new fixture. Extract the prompt, capture the ideal output, write a fixture.

#### When to Retire vs Rotate a Fixture

**Retire (don't replace):**
1. **The pattern no longer exists.** Deprecated pattern = no fixture needed.
2. **Consistently scores 1.0 across all models.** No signal. Keep one simple fixture as a smoke test.
3. **No recent PR exercises this pattern.** If nobody's building this anymore, the fixture is testing a dead path.

**Rotate (replace with fresh extraction):**
1. **Fixture has expired (past its TTL).** Extract from a recent PR covering the same pattern.
2. **Major refactor changed the fundamental approach.** The old fixture's structure no longer makes sense. A new PR post-refactor is the right source.
3. **Score drift detected between diagnostics.** Early rotation beats patching.

### Keeping Goldens Current: Rotation, Not Patching

Golden implementations are the ground truth. When they go stale, the harness grades against outdated patterns and scores become meaningless. The solution is **rotation** — replace the entire fixture from a fresh PR — not patching individual files on the after branch.

#### The Staleness Problem

```
Week 1: Golden uses createRouteConfig v1 → agent output matches → score 0.95
Week 8: Team migrates to createRouteConfig v2 → agent output uses v2 → score 0.60
         The agent is actually correct. The golden is wrong.
```

With the old approach (rebase + patch), you'd update the after branch to use v2. But that means rebasing both branches, resolving conflicts, updating assertions, verifying both branches still build — and hoping you didn't cross-contaminate before/after.

**With rotation:** extract a new fixture from a recent PR that already uses v2. The new fixture is born current. The old fixture is archived.

#### The Rotation Workflow

```
1. DETECT — Age diagnostic or check-expired flags a fixture
   "add-endpoint-simple expired 5 days ago. Recent PRs with same pattern: #215, #228"

2. PICK SOURCE — Choose a recent PR covering the same pattern
   PR #215: "Add TeamMembers CRUD endpoint" — good, covers route + schema + hooks

3. EXTRACT — Create new fixture from that PR
   bun run harness create-fixture --from-pr 215 \
     --name add-endpoint-simple \
     --tier simple

   This creates fresh raw/subject/after branches from #215's parent/merge commits

4. AUTHOR — Run the subject context interview
   bun run harness author-context add-endpoint-simple
   (The domain is different — TeamMembers not Projects — but the patterns are the same)

5. REVIEW — Check generated assertions, add expected-questions
   The assertions reflect current patterns because the PR uses current patterns

6. ARCHIVE — Rename old fixture branches
   fixture/add-endpoint-simple/raw     → archive/add-endpoint-simple-v1/raw
   fixture/add-endpoint-simple/subject → archive/add-endpoint-simple-v1/subject
   fixture/add-endpoint-simple/after   → archive/add-endpoint-simple-v1/after

7. BASELINE — Run the new fixture to establish scores
   bun run harness run add-endpoint-simple
```

The fixture name (`add-endpoint-simple`) stays the same — it represents the *pattern being tested*, not the specific feature. The underlying PR changes each rotation, but the harness tracks the same pattern over time.

#### CI Integration: Rotation Prompts

```ts
// In CI: after PR merge, check if any fixtures should rotate early
interface RotationCandidate {
  fixture: string;
  status: "expired" | "expiring_soon" | "drift_detected";
  currentSourcePR: number;       // PR the current fixture was extracted from
  candidatePRs: number[];        // Recent merged PRs covering the same pattern
  recommendation: string;        // "Rotate now" | "Rotate within 1 week" | "Monitor"
}
```

The CI check runs on PR merge and posts a comment if any fixtures are candidates for rotation: "Fixture `add-endpoint-simple` expired 3 days ago. PR #215 covers the same pattern — run `bun run harness create-fixture --from-pr 215` to rotate."

#### Oracle-Detected Rotation Needs

During age diagnostics, the Oracle can detect when the agent's output is *more correct* than the golden:

```
Oracle: "Agent used createRouteConfig v2 (current pattern). Golden uses v1
  (deprecated). Agent is correct. Fixture needs rotation."
  Prescription type: fixture_rotate
  Pattern: add-endpoint
  Confidence: 0.92
  Candidate PRs: [215, 228]
```

This is a rotation signal, not a patch signal. The Oracle says "replace the fixture" not "edit the golden."

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
| **Weekly** | Age diagnostic + expiration check | Auto: full matrix, ~30 min, flags drift + expired fixtures |
| **Per major PR merge** | Rotation candidate check | Auto: CI flags fixtures whose pattern was touched by the PR |
| **When fixture expires** | Rotate from recent PR | Semi-auto: extract new fixture, author subject context (~30 min) |
| **Quarterly** | Full fixture audit | Manual: retire dead patterns, verify coverage across all pattern categories |
| **After major refactor** | Bulk rotation | Rotate all fixtures touching affected patterns from post-refactor PRs |

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
3. **Fixture Freshness** — ~~Auto-generate from new PRs?~~ **Resolved: Rotation model.** Fixtures have a TTL (4-8 weeks by tier). When they expire, extract fresh ones from recent PRs. No rebasing, no patching — full replacement. See "Fixture Expiration & Rotation."
4. **Partial Credit** — An implementation that works but uses different patterns is... correct? wrong? The scoring weights encode your opinion here.
5. **Multi-Model** — Different models (Opus, Sonnet, Haiku) will score differently as Implementer. Track per-model or optimize for one?
6. **Subject Fidelity** — ~~How realistic?~~ **Resolved: The Vague PM.** Subject is deliberately a stereotypical PM who gives vague instructions and doesn't volunteer detail. Knowledge is gated behind Q&A pairs with trigger keywords. Authoring interview captures domain knowledge + produces expected-questions in one session. See "Subject (The Vague PM)" and "Fixture Authoring."
7. **Oracle Reliability** — The Oracle is itself an LLM. Can it reliably diagnose *why* a score changed? What if its prescriptions oscillate (patch A → revert A → patch A)?
8. **Dogfood Recursion** — If the `_self` fixture's docs are themselves tuned by the loop, does the system converge or oscillate? Is there a fixed-point?
9. **MCP Server Scope** — Which operations should be tools (callable by Claude) vs CLI commands (run by humans)? How much autonomy does Claude get?
