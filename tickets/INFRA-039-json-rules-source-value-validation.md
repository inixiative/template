# INFRA-039 — json-rules validates a value against its source's options

**Status:** 🆕 Not Started · **Line:** INFRA · **Priority:** Medium · **Related:** Zealot ZLT-5983 (item 3), ZLT-6030 (#3025), INFRA-024

## Context

`validateRuleInLens` checks that a rule's fields, operators and value shapes fit the lens. It does
not check that a value at a sourced field is one the source offers. Every consumer that needs that
answer writes it by hand. In Zealot there are three copies:

- `outsideLensTargets` (save gate): runs the lens's identity source query and refuses a named uuid
  the query does not return (another tenant's row, a trashed row, a uuid that does not exist).
- `readEnrichmentCriteria` / `checkAssertedValuesAreStored` (AI draft check): walks the tree by hand
  to pair each value with the field a sibling clause names, then looks the value up in that field's
  group of the source's options.
- `readMatchFilterCriteria`: the same pairing for reference-match bands.

The lens already owns the vocabulary, so it should answer "is this value one the source offers".

## Shape

The engine stays pure: no database, no cache. The caller passes the option sets it already
materialized, the same `SourceValues[]` that `projectLens(lens, { sourceValues })` takes:

```ts
validateRuleInLens(rule, lens, { sourceValues })
```

- A literal at a sourced field must be one of that source's options. A new issue code
  (`value_not_offered`) names the path, field and value.
- **Grouped sources:** a source with `groupBy` is checked within the group a sibling clause names
  (the field label / source label pair for an enrichment value). This is ZLT-5983 item 3.
- A source the caller did not pass is not checked. A leaf `describeRuleSources` marks `dynamic`
  (path/bind values, substring, range, window) is not checked.
- Without `sourceValues`, behaviour is unchanged.
- **Fuzzy sources.** A `SourceSpec` may declare `fuzzy` (reusing `FuzzyConfig`) for sources whose values
  are typed rather than picked: job titles, company domains, free-ish enrichment values. Under
  `fuzzy`, a value is accepted when it is close to an option (normalized case, whitespace and
  punctuation, then the config's threshold), and the issue names the closest options instead of
  refusing outright. An identity source (one with a `label`, which names rows by uuid) can never
  be fuzzy: `validateNarrowing` refuses `fuzzy` there.

`describeRuleSources` already finds each source's values with the operator catalog, so this is that
walk plus a membership check, not a new traversal.

## What it retires (Zealot)

`outsideLensTargets` (the caller materializes live and passes the result), the hand pairing in
`readEnrichmentCriteria` / `readMatchFilterCriteria`, and most of `checkAssertedValuesAreStored`
(its typed number/date comparison stays until ZLT-6029 moves typed comparisons into the lens).

## Definition of done

- Option and issue code shipped in json-rules, with tests for identity, grouped and dynamic sources.
- Template's rule-reference save gate uses it; Zealot follows through ZLT-5983.
