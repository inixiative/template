---
name: code-walkthrough
description: Use when asked to explain, walk through, or document how a file or function works. Produces a plain-English prose explanation of the logic grounded in the code's actual variable, method, field, and type names — in execution order, with the load-bearing "why"s and concrete end-to-end traces.
---

# Code Walkthrough

Explain how a piece of code works in plain English, grounded in its **real names**. The output is prose a reviewer can read without the file open, that still maps 1:1 to the file.

## Rules

- **Read the current file first** — never explain from memory or a summary; names and logic drift.
- **Use the actual identifiers inline** — methods, variables, fields, types — verbatim (e.g. "`walkUp(slug)` finds rows whose `componentRefs` has `slug`"). Never replace a name with a generic noun ("the helper", "the list").
- **Follow execution / logical order, not declaration order** — lead with what it's *for*, then the entry point, then each helper in the order it's actually reached.
- **Explain the why, not just the what** — the reader can see what a line does; tell them what it's *for* and what would break without it. Call out invariants, ordering constraints, re-entrancy, and non-obvious guards explicitly.
- **Name and separate the id-/type-spaces** when the code juggles several (e.g. slug vs row id vs snapshot id) — say which is which and where each is produced and consumed.
- **Match reality** — if a name is stale, a branch is dead, or a guard is now redundant, say so. Don't narrate the intended behavior as if it were the real behavior.
- **End with concrete traces** — one or two realistic inputs walked through the whole flow.
- Cite `file:line` where it helps, but the prose must stand on its own.

## Structure

1. **What it's for / what it maintains** — a sentence or two; state the invariant if there is one.
2. **Entry point** — the public/exported function or the registration, and the top-level control flow.
3. **Helpers, in call order** — each named, what it does, the why.
4. **Load-bearing design points** — ordering, re-entrancy, gotchas the next editor could break.
5. **End-to-end** — concrete traces ("edit component B → `walkUp(B)` → …").

Keep it skimmable: tight paragraphs or bullets, **bold the names** as you introduce them.
