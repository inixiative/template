# Component API Guidelines

Authoring standards for design-system component APIs in `packages/ui`.

## Contents

- [Core Authoring Pattern](#core-authoring-pattern)
- [Required Props and Composition Rules](#required-props-and-composition-rules)
- [Variant Naming](#variant-naming)
- [State Matrix Requirements](#state-matrix-requirements)
- [RTL Requirements](#rtl-requirements)
- [Export Rules](#export-rules)
- [Deprecation Rules](#deprecation-rules)

---

## Core Authoring Pattern

All primitives and compositions should follow existing repo patterns:
- CVA-powered variants
- `React.forwardRef` for DOM-compatible refs
- `cn()` for class composition
- stable and minimal public props

Avoid new wrapper abstractions unless explicitly required by product scope.

---

## Required Props and Composition Rules

For components where they apply, support:
- `show?: boolean`
- `disabledText?: string`
- `className?: string`
- forwarded `ref`

Guidelines:
- `show` should allow conditional non-rendering without caller boilerplate.
- `disabledText` should be caller-provided and translated in app code.
- Labels and helper/error text should be composed through form field patterns instead of ad hoc markup duplication.

---

## Variant Naming

Use only clear semantic names for variants:
- `size`: visual scale (`sm`, `md`, `lg`)
- `tone`: semantic meaning (`default`, `success`, `warning`, `error`, etc.)
- `intent`: interaction emphasis (`primary`, `secondary`, `ghost`, etc.)
- `state`: UI state (`loading`, `invalid`, `active`, etc.)

Rules:
- Variant APIs must be implemented with CVA.
- Avoid one-off variant names that duplicate meaning across components.
- Prefer extending existing variant names rather than introducing near-synonyms.

---

## State Matrix Requirements

Every component must explicitly support and validate these states where applicable:
- default
- disabled
- loading
- error/invalid
- empty

If a state is not applicable, document why in the component file or story.

---

## RTL Requirements

Use CSS logical properties instead of physical left/right values:
- `margin-inline-start` instead of `margin-left`
- `margin-inline-end` instead of `margin-right`
- `padding-inline-start` instead of `padding-left`
- `padding-inline-end` instead of `padding-right`

Any directional styling must remain correct under `dir="rtl"` without ad hoc overrides.

---

## Export Rules

Each component module should export:
- the component itself
- its variant helper (for example `buttonVariants`)

Package/public barrels should re-export both when the variant helper is part of the supported API.

---

## Deprecation Rules

- Mark deprecated props/components with JSDoc `@deprecated`.
- Include replacement guidance in the deprecation message.
- Keep deprecated APIs functional until the announced removal version.
