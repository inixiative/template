# FEAT-023: Typed inquiry actions

**Status**: 🆕 Not Started
**Priority**: Low
**Created**: 2026-10-31
**Related**: [FEAT-016](./FEAT-016-inquiry-lineage-and-nesting.md) (lineage and child inquiries)

## Why (Aron, 2026-10-31)

"User can send 'refer to tribe.' That's the whole idea. That's what they do. The action, when admin approves, would be 'send invitation,' right? Inquiries chain like that all the time. That's pretty common. If you want to type things, you can do that. It's a JSON with specific keys and values for actions. That's something that maybe we should be doing."

## The idea

What an inquiry does when it resolves is declared as data: a typed JSON action with specific keys and values per action type (for example "send an `inviteOrganizationUser` inquiry with this content"), not only handler code. Chained inquiries become a declared action the resolution runs, which FEAT-016's lineage then records.

## To work out

- The action catalogue and each action's keys and values (one schema per action type, like the inquiry content schemas).
- Where the actions live: on the inquiry type's handler registration, on the inquiry row, or both.
- How a declared action is authorized: it runs as the resolver, through the same permission checks as the route it stands in for.
