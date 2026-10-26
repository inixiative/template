# Domain Docs

<!-- toc:start -->

## Contents

- [What this is for](#what-this-is-for)
- [The row: Problem, Use, Read, Signs](#the-row-problem-use-read-signs)
  - [Problem is the job in plain words](#problem-is-the-job-in-plain-words)
  - [Use is the exact thing](#use-is-the-exact-thing)
  - [Read is where it is written](#read-is-where-it-is-written)
  - [Signs you're bypassing it](#signs-youre-bypassing-it)
- ["Said as" phrasings](#said-as-phrasings)
- [Sibling tables](#sibling-tables)
  - [The no-primitive row](#the-no-primitive-row)
- [Errors, two-sided](#errors-two-sided)
- [Migrations in progress](#migrations-in-progress)
- [Under construction](#under-construction)
- [When this is not your domain](#when-this-is-not-your-domain)
- [When the Warden misses its own moments](#when-the-warden-misses-its-own-moments)
- [What not to write](#what-not-to-write)
- [How the region builder uses this](#how-the-region-builder-uses-this)

<!-- toc:end -->

---

## What this is for

Foundry's Wardens read our docs. At each moment of a coding agent's work (the user's message, the agent's plan or action) a Warden holding one region of the docs answers two questions: *is this about my domain?* and *is there something that already exists for it?* When the answer is yes it points: "look over here: `createLock`, `packages/db/src/lock/createLock.ts`, CONCURRENCY.md § Distributed Lock".

The pointer fails in a specific way when docs are written only for people who already know the names. The agent says "two jobs keep writing the same row"; the doc says `db.findForUpdate`. The Warden finds the area but not the thing. Aron (2026-10-15): "We should have broad language in the docs and good examples of function class names, function names, and systems, in whatever format the agent needs them, in order to make this task tenable."

This doc is the language guidance for writing **domain knowledge**: the parts of `docs/claude/*` that name a primitive, pattern, rule or system and say when to use it. The conventions for doc structure (TOC, stubs, alignment review) stay in [DOCUMENTATION.md](DOCUMENTATION.md); this doc is about the words. The region builder (`.foundry/regions/`) follows these rules when it assembles Warden knowledge from the docs and the code catalog; a doc written this way needs no translation.

---

## The row: Problem, Use, Read, Signs

Every named thing a doc introduces gets one row, in a table with these four columns, in this order:

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| Exclusive access to a row, or a find-or-create race: "lock the row while I update it", "two workers grabbing the same thing", "avoid a double-apply" | **`db.findForUpdate`** · primitive `packages/db/src/client.ts` — inside `db.txn`; `upserting: true` for create-if-missing | DATABASE.md § Row Locks and Create-If-Missing | a bare `.upsert(`; a caught P2002 / unique violation then re-read; a raw `SELECT … FOR UPDATE` |

A paragraph may introduce the thing; the table is what the Warden matches on. The shape is Grant's `docs/primitives/README.md` in Zealot, adopted for template, Kingdom and Tribe.

### Problem is the job in plain words

The Problem cell is **what someone is trying to do**, written the way they say it before they know the name. It is not a restatement of the name.

- Good: `List a resource with paging, search, sort or filters`
- Bad: `Pagination` (the name again; a Warden that already knew the word would not need the row)

Add two to six "said as" phrasings (below) to the cell when the job has several everyday wordings. Problem is where the broad language lives; the other three columns are exact.

### Use is the exact thing

The Use cell names the primitive, pattern, rule or system **exactly as it is spelled in code**, bold, followed by its kind and where it lives, then when to choose it over its siblings:

`**createLock** · primitive `packages/db/src/lock/createLock.ts#createLock` — first holder keeps the resource; newest-wins is claimLane`

One consistent form: `name · kind path#symbol — choose when`. Kinds are `primitive`, `pattern`, `rule`, `system`, `model`, `script`. A model's where is its schema file; a script's is `package.json` or the script path; a pattern's is the doc section that defines it.

- Good: `**paginate** · primitive `apps/api/src/lib/prisma/paginate.ts#paginate` — offset pages with totals; cursorPaginate for long or changing sets`
- Bad: `the pagination helper in the prisma lib` (not quotable; the agent cannot grep it or import it)

### Read is where it is written

The Read cell is the doc section, by path and heading, and for a pattern the code it is about:

- Good: `DATABASE.md § Row Locks and Create-If-Missing; CONCURRENCY.md § Distributed Lock (createLock)`
- Good (doc member): `COMMUNICATIONS.md § Render Pipeline · code `composeTemplate`, `interpolate`, `settle``
- Bad: `see the database docs` (which section? the Warden quotes Read verbatim in its pointer)

### Signs you're bypassing it

The Signs cell describes the code an agent writes when it rebuilds the thing instead of using it: the shape of the hand-rolled version, specific enough to recognise in a diff or a plan.

- Good: `a module-level `let pending = Promise.resolve()` chain, a boolean busy flag, or an async-mutex dependency to order writes to one resource`
- Bad: `not using createSerializedQueue` (circular; names nothing an agent would recognise in its own code)

Where a CI rule or lint catches the bypass, name it: `no-create-race-machinery fails new .upsert( and P2002 catches`.

---

## "Said as" phrasings

Phrasings are the ways a user or an agent says the job in a message or a plan without knowing the name. They go in the Problem cell (or, where a table has a job line, under it as *Said as:*). Two to six per thing; three to twelve words each; no identifiers, no backticks.

Rules:

- **Both voices.** How the user asks for it or corrects toward it, and how an agent describes its plan right before hand-rolling it. Good: `"make sure this job doesn't run twice"` (user) and `"I'll add a boolean so it doesn't run twice"` (agent, the bypass shape). Bad: a list of synonyms for the name (`"distributed lock", "mutex", "lock primitive"`), which an agent that does not know the name will not say either.
- **Distinct from the siblings.** In a sibling table each member's phrasings must separate it from the others. Good: createLock `"the first one to get it keeps it"`, claimLane `"the newest one should win, cancel the older"`, createSerializedQueue `"run these one at a time in this process"`, db.findForUpdate `"read the row, then update it, without a race"`. Bad: `"handle concurrency"` on all four.
- **Sourced from real corrections.** Lift the words Aron or a reviewer actually used when they pointed an agent at the thing. Good: db.findForUpdate ← `"why isn't this just open a transaction, lock the row, update, commit"` (his words were "why isnt this just txn => select for update => update => close txn"). Bad: a phrasing invented to sound broad (`"ensure data consistency"`).
- **Plain, not clever.** Good: `"return the related rows in the same call"`. Bad: `"hydrate the relational closure eagerly"`.

---

## Sibling tables

Where two or more things do neighbouring jobs (lock vs lane vs queue; readRoute vs actionRoute; paginate vs cursorPaginate), the doc gets a comparison table **per job**, above the member rows. The job decides the sibling, so the table is headed by the job in plain words, with its own *Said as* line:

**Job: serialize writers across processes or jobs (one owner, one row, one dedupe key)** — CONCURRENCY.md (preface table)
*Said as:* "I need to stop two of these running at once", "which lock do I use here", "two jobs keep writing the same row"

| Member | Use when | Not when (use instead) |
|---|---|---|
| **createLock** | one process owns a resource; first holder keeps it | newest should win (claimLane); rows read-then-written in a txn (db.findForUpdate) |
| **claimLane / watchLane** | newest job per (handlerName, dedupeKey) wins | first holder must keep it (createLock) |
| **db.findForUpdate** | SELECT … FOR UPDATE inside db.txn; upserting: true for create-if-missing | non-row ownership (createLock) |

- Good: every row's *Not when* names the sibling to use instead, so a wrong pick is one hop from the right one.
- Bad: a table that lists members with a description each and no *Not when*: that is a glossary, and the Warden still cannot choose.

### The no-primitive row

Where the docs say when the job needs **no** primitive, that option is a row, so the Warden can also say "nothing to use here":

| Member | Use when | Not when (use instead) |
|---|---|---|
| *plain write in db.txn* | the write does not depend on a value read first; every mutation already runs in its own transaction | read-then-update or find-then-create (db.findForUpdate) |
| *unique constraint, let the insert fail* | a duplicate is the caller's mistake: the global handler maps P2002 to 409 | create-if-missing must return the existing row (db.findForUpdate upserting: true) |

- Good: the row cites the doc or rule that says the primitive is not needed (CONCURRENCY.md § Serialized Queue › When NOT to use).
- Bad: inventing a "just do it inline" row where no doc says so; the row is a claim and needs its source.

---

## Errors, two-sided

Every error type, error class and `makeError` status family is written from both sides: on the error's own row (its class, what throws it) and on each thrower's row (what it throws). An agent that sees `FindForUpdateLockTimeoutError` in a stack trace and an agent about to call `db.findForUpdate` both land on the same pair of rows.

- Good: `FindForUpdateLockTimeoutError` · error, class `conflict` (409), thrown by `db.findForUpdate`, `acquireFindForUpdateLock`; and on `db.findForUpdate`'s row: *throws FindForUpdateLockTimeoutError (conflict)*.
- Bad: an error named only in a code example, with no class and no thrower; the Warden cannot classify it and the agent writes a new one.

Use the classes the codebase already defines (ERRORS.md § Status conventions, `HTTP_ERROR_MAP`, json-rules' `UsageError` / `LensRefusal`); do not invent a taxonomy.

---

## Migrations in progress

When we are moving from A to B, the doc says so in one table, so an agent that finds A next door does not copy it:

| Moving from (don't copy) | To (copy this) | Read |
|---|---|---|
| Pre-launch: releases `prisma db push --accept-data-loss`; schema changes are `db:push` | Launched (`launched: true` in `project.config.ts`): `prisma migrate deploy`; schema changes through `db:migrate` and committed migrations from `0_init` | DATABASE.md § Schema Changes: Push Before Launch, Migrations After |
| Routes mounted by hand in the module's index.ts (`userRouter.openapi(route, controller)`) | File-based `autoRegisterRoutes` over routes/ and controllers/ | FEATURES.md § API Architecture & Routing |

- Good: both sides named exactly, with the cut-over condition and where it is documented.
- Bad: `legacy code exists, prefer the new way` (which code? which way? the agent cannot tell which side it is looking at).

Source these from the doc's own Direction sections, from FEATURES.md status marks and from the tickets; a migration no doc mentions does not go here, it goes in a ticket first.

---

## Under construction

Open work an agent cannot use yet, with the ticket or PR, so it neither builds against it nor rebuilds it:

- Password change and account linking for a signed-in person need JWT-authenticated routes, not built yet — FEATURES.md § Authentication (🟡 Password Change and Account Linking)
- Cursor (keyset) pagination mode: core landed, signing and the remaining pieces in progress — ticket API-003

- Good: the thing, its state, and the reference that will change when it lands.
- Bad: `notifications are coming` (no ticket, no state; it reads as a feature that exists).

Only in-progress, in-review and designed work goes here, plus roadmap items an agent would plausibly assume exist (feature flags, notifications, SSO). Not-started backlog stays in `tickets/`.

---

## When this is not your domain

A region that fires on moments nobody owns is as costly as one that misses its own. Each region names three to five moments that **mention its words but belong elsewhere**, with the region that answers, phrased for a yes/no classifier:

| Sounds like this region | Belongs to |
|---|---|
| A lazily created client for an external service (`client ??= new …`) | adapters-integrations |
| Who is recorded as the actor on a write made by a job | audit-soft-delete |
| Returning the related rows an inquiry's sender needs in one call | inquiry-routes-ui |

- Good: taken from the region's real false positives (the eval's wrong-yes moments, mapped to their owner), so the examples are the confusions that actually happen.
- Bad: `anything not about the database` (names no moment and no owner; the classifier cannot use it).

Where the doc's own boundary says "X is the Y region", that sentence is already a negative example; write it as a moment, not as a list of identifiers.

---

## When the Warden misses its own moments

When a region does not recognise the moments it owns, the fix is in the plain-language cells, not in more identifiers. Rewrite the region's concept, purpose and phrasings in the asker's words, sourced from the corrections that pointed at it, until a reader who does not know the names would still say "that is about this".

- Good: test-harness went from recognising 0 of its 11 moments to 3 after its concept said "record the real provider once and replay it", "don't stub the API in tests, use cassettes", "move away from spying on global fetch" (Aron's words), instead of "VCR cassettes, `vcr.queue`, `vcr.capture`".
- Bad: adding `createFactory`, `buildX` and `createX` to a region that already named them, when the moments say "seed a user for this test" and "why not use these factories".

---

## What not to write

Domain docs are read by a model with a fixed budget per region (about 20k tokens). Every line that is not a row, a rule or a boundary costs recall. Do not write:

- **Correction logs.** "Aron said on 2026-10-07 that…" belongs in the feedback lifecycle, not the doc. Resolve the correction into the row it changes (a sharper Problem, a new Signs, a no-primitive row), with no date and no name.
- **Dates and people.** A doc states what is true now. Provenance lives in git and in tickets.
- **Tool-specific wording.** Not "when Claude Code proposes", not "in a Codex session": the same row must hold for any harness, any model and a human reader.
- **Marketing and reassurance.** Not "robust", "seamless", "powerful"; not "this makes it easy to". Say what it does and when to choose it.
- **Restatements of the name as the problem.** `Pagination | paginate` is a row with no Problem.
- **Narrative code walkthroughs in the row.** The row points; part 4 (the doc section itself) explains.
- **Duplicates of a rule that already exists.** Sharpen the existing row; do not add a second one next to it.

- Good: `| Guard a create or a list under an owner: "may this caller add a contact to this organization" | **validateSubmodelPermission** · primitive `apps/api/src/middleware/validations/validateSubmodelPermission.ts` — an action on the loaded record itself is validatePermission | PERMISSIONS.md § validateSubmodelPermission | a validatePermission('manage') on the parent standing in for the child's rule |`
- Bad: `On 2026-10-26 Aron reminded Claude that collection routes should use the robust validateSubmodelPermission middleware, which makes gating seamless.`

---

## How the region builder uses this

The Warden knowledge in `.foundry/regions/<region>/knowledge.md` is generated, never hand-edited. The builder reads `docs/claude/**`, the agent entrypoint (`CLAUDE.md`), `FEATURES.md` and the code catalog, cuts them into concept regions under the size ceiling, and renders each region as: what it covers, the domain, *Migrations in progress*, *Under construction*, then part 3 (every member as a Problem | Use | Read | Signs row, sibling tables per job with *Said as*, errors two-sided) and part 4 (the doc sections verbatim). A doc that follows this guide flows through unchanged: its rows become the Warden's rows, its phrasings become what the Warden matches on, its Read cells become the pointers it quotes. A doc that does not is the gap the Warden misses by.
