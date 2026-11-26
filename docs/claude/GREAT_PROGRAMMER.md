# What Makes a Great Programmer

<!-- toc:start -->

## Contents

- [Simplicity Is Subtraction, Not Restraint](#simplicity-is-subtraction-not-restraint)
- [Optimize for the Reader, Not the Writer](#optimize-for-the-reader-not-the-writer)
- [Essential Complexity vs. Accidental Complexity](#essential-complexity-vs-accidental-complexity)
- [Design Before You Type — Explain the Mechanism Plainly](#design-before-you-type--explain-the-mechanism-plainly)
- [Deep Modules, Honest Invariants, No Cutouts](#deep-modules-honest-invariants-no-cutouts)
- [Delete Courageously — and Reassess Every Surviving Part After Refactoring](#delete-courageously--and-reassess-every-surviving-part-after-refactoring)
- [Falsify the Premise, Don't Defend Consistency](#falsify-the-premise-dont-defend-consistency)

<!-- toc:end -->

> "Any intelligent fool can make things bigger, more complex, and more violent. It takes a touch of genius — and a lot of courage — to move in the opposite direction."
> — **E. F. Schumacher**, *Small Is Beautiful* (1973) *(often popularly attributed to Albert Einstein)*

Code is read at least ten times as often as it is written. With coding agents reading every file on every task, the real ratio is closer to fifty-to-one.

Every extra route, flag, wrapper, parallel store, or nested branch you introduce is not a one-time cost when you type it — it is a permanent tax paid by every human and every agent that has to hold the system in their head to make the next change.

Writing code that works is table stakes. A great programmer writes the **smallest, clearest system that solves the whole problem through the primitives already in place**, so the next reader understands it in thirty seconds and cannot misuse it.

---

## Simplicity Is Subtraction, Not Restraint

> "Perfection is finally attained not when there is no longer anything to add, but when there is no longer anything to take away."
> — **Antoine de Saint-Exupéry**, *Wind, Sand and Stars* (1939, trans. Lewis Galantière)

> "There are two ways of constructing a software design: one way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies."
> — **C. A. R. Hoare**, Turing Award Lecture (1980)

> "Simplicity is prerequisite for reliability."
> — **Edsger W. Dijkstra**, *How Do We Tell Truths That Might Hurt?* (EWD498, 1975)

Adding a layer to solve a local problem feels safe and thorough. It is almost always a failure to see the right place in the existing system. Treat every new abstraction, table, route, store, middleware, and config option as guilty until proven necessary.

**Rejection test — The 30–50% Subtraction Pass:**
Before writing code (from your 10-line prose plan) and again before merge, assume your design has 30–50% too much surface area. Ask of every new file, route, column, Redis key, flag, and middleware: *which existing primitive (auth, ReBAC, JWT, rate limit, transitions, field encryption, hooks, scoped DB) already owns this job or can absorb it cleanly?* If you cannot show a failed attempt to express it on the existing primitive, delete the new piece and fold it in.

---

## Optimize for the Reader, Not the Writer

> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand."
> — **Martin Fowler**, *Refactoring* (1999)

> "Everyone knows that debugging is twice as hard as writing a program in the first place. So if you're as clever as you can be when you write it, how will you ever debug it?"
> — **Brian W. Kernighan & P. J. Plauger**, *The Elements of Programming Style* (2nd ed., 1978)

A file should read top-to-bottom like a controller: flat guard clauses, single-line early exits, obvious happy path at the end. No nested `if`/`else` pyramids. No grab-bag service files exporting a dozen unrelated functions. No comments narrating what well-named code already says (see [STYLE.md](STYLE.md)).

**Rejection test — The 30-Second Scan:**
Open any file you wrote. Can another engineer understand every branch, every error exit, and the single thing this file exports in 30 seconds without scrolling back and forth or opening three sibling helpers? If not, flatten the control flow and split by single responsibility.

---

## Essential Complexity vs. Accidental Complexity

> "The essence of a software entity is a construct of interlocking concepts... Most of the big past gains in software productivity have come from removing artificial barriers that have made the accidental tasks inordinately hard."
> — **Fred Brooks**, *No Silver Bullet* (1986)

> "The critical thing to distinguish it from 'simple', is that easy is relative." — *and:* "Simple means one fold or one braid."
> — **Rich Hickey**, *Simple Made Easy* (2011)

Two concepts that change for different reasons, have different lifecycles, or belong to different owners do not belong in one table, one flag, or one function — even if merging them saves ten lines today. Conversely, one concept split across two parallel paths (two auth checks, two rate limiters, two JWT signers) guarantees they will drift apart and fail silently.

**Rejection test — One Concept, One Place:**
Trace a single rule or invariant across your change (for example, "must have verified 2FA" or "row is not soft-deleted"). Does it live in **one** structural place (the permission schema, the middleware, the primitive), or is it re-checked in three handlers? One concept in two places is a bug waiting to happen.

---

## Design Before You Type — Explain the Mechanism Plainly

> "The best programs are written so that computing machines can perform them quickly and so that human beings can understand them clearly."
> — **Donald E. Knuth**, *Literate Programming* (1984)

A great software designer starts from a clean conceptual model. If you cannot explain how a mechanism works in plain prose and a simple diagram, you do not understand it yet — do not write code.

Code written turn-by-turn without a clear mechanism accretes scar tissue: a public route here, a Redis bridge token there, a hand-rolled middleware to patch a gap the first patch created. Each turn feels locally justified; the sum is 3× larger than the clean design.

**Rejection test — Prose and Diagram Before Code:**
Before editing code on any non-trivial change, write the flow in 10 lines of plain prose (and, for multi-step mechanisms, a simple diagram — Mermaid or a Blueprint scene built as a "but… so…" chain where every part earns its place). If a part cannot justify why the simpler version before it failed, cut that part before writing a line of code.

---

## Deep Modules, Honest Invariants, No Cutouts

> "The best modules are those that provide powerful functionality yet have simple interfaces. I use the term deep to describe such modules."
> — **John Ousterhout**, *A Philosophy of Software Design* (2018)

> "Fools ignore complexity. Pragmatists suffer it. Some can avoid it. Geniuses remove it."
> — **Alan Perlis**, *Epigrams on Programming* (1982)

Never bolt an escape hatch (a skip-check flag, clamp bypass, legacy mode, or one-off carve-out) onto a primitive to accommodate a clumsy caller. Once a primitive makes an exception to its own guarantees, every caller has to audit the implementation to know whether the invariant still holds.

**Rejection test — No Special Cases, No Cutouts:**
Does your change add a boolean flag, bypass option, or one-off carve-out to an existing primitive? Restate the requirement another way; if a sibling case behaves differently, you have a special case — fix the general rule instead.

---

## Delete Courageously — and Reassess Every Surviving Part After Refactoring

> "If we wish to count lines of code, we should not regard them as 'lines produced' but as 'lines spent'."
> — **Edsger W. Dijkstra**, *On the Cruelty of Really Teaching Computing Science* (EWD1036, 1988)

> "One of my most productive days was throwing away 1,000 lines of code."
> — **Ken Thompson** *(quoted in Eric S. Raymond, The Art of UNIX Programming, 2003)*

The best diff often has a negative line count. After an iterative build, review cycle, or architectural change, step back and inspect the *whole* touched subsystem from scratch as if you were building it fresh with everything you now know — never defend a file, route, fallback, or helper just because it already passed tests on an earlier turn.

When an architectural change introduces a new invariant or replaces an old mechanism (for example, an eager DB hook replacing lazy setup, a schema relation replacing manual joins, or a primitive absorbing a local layer), **superseded plumbing does not delete itself.** Agents wire up the new path and leave old fallbacks, guards, helpers, branches, wrappers, and tests standing next to it, forcing the human reviewer to spend hours reading dead layers to spot what no longer needs to exist.

**Rejection test — Fresh-Eyes Rebuild & Superseded-Plumbing Audit:**
1. **Fresh-eyes rebuild:** Ask: *knowing everything I know now, if I built this from scratch in one pass, what would I leave out?*
2. **Invariant-replacement trace:** List every invariant or mechanism this change established or replaced. Trace every surviving file, helper, hook, fallback, branch, route, column, test, and doc in the touched subsystem — not only the new diff lines — and ask of each: *does this part still need to exist now that the new invariant holds?*
3. Delete everything superseded before pushing — on **every** refactor round, not just Round 1.

---

## Falsify the Premise, Don't Defend Consistency

> "It is much easier to prove a flawed system internally consistent than to admit its starting axiom is wrong."

**Why this goes wrong:** Once a model is written and passes tests or adversarial reviews, agents treat it as a fixed axiom. Tests and adversarial reviews only prove consistency *inside* the current premise — they never prove the premise itself is right. Holding on to a flawed starting assumption turns every new requirement into local patches and extra machinery, and leads to self-inflicted objections: rejecting a simpler alternative because of a problem that only exists under another assumption already in doubt.

**Why we ask for pushback:** Both in architecture and in product, the method is walking through implications — *"if we do it this way, what actually happens?"* Pushback and double-checks exist to surface real failure modes before committing — never to argue back into sunk-cost code, and never to agree uncritically. Sunk-cost defense protects the old model from scrutiny; sycophancy protects the new suggestion from scrutiny. Real listening and real pushback are the exact same move applied symmetrically to both sides.

**Rejection test — The Symmetrical Premise Check:**
Whenever a load-bearing assumption is questioned, walk through the implications of both sides on equal footing before recommending one:
1. **Name both premises** plainly in one line each (**Current** vs. **Alternative**).
2. **Trace concrete, competing user intents** — include at least one hard case for the current premise and at least one hard case for the alternative. **Do not confabulate smooth outcomes or hand-wave over gaps — the holes are the whole point.**
3. **Compare the machinery delta** — what tables, columns, hooks, routes, or branches disappear vs. get added under each premise.
4. **Check for self-inflicted objections** — verify that no argument against the alternative depends on another assumption currently in doubt; if it does, drop both assumptions together and re-evaluate.
5. **Decide from exposed holes and trade-offs, never sunk cost** — push back hard when the alternative breaks a concrete scenario or adds real risk, and drop the current model cleanly when it is the one accumulating workarounds. Never cite existing code, green tests, or earlier reviews of the old premise as evidence.
