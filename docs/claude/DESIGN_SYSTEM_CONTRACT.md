# Design System Contract

Governance contract for `@template/ui` and shared design primitives.

## Contents

- [Scope](#scope)
- [Token Policy](#token-policy)
- [Component API Policy](#component-api-policy)
- [i18n Policy](#i18n-policy)
- [Release Policy](#release-policy)
- [Compliance and Exceptions](#compliance-and-exceptions)

---

## Scope

This contract applies to:
- `packages/ui`
- UI usage in `apps/*`
- shared style tokens in `packages/shared/styles`

This contract is mandatory for new UI work and updates to existing components.

---

## Token Policy

- Do not hardcode colors, spacing, radius, z-index, shadows, motion timings, or typography sizes in UI code.
- Use design tokens from shared theme sources (`packages/shared/styles/theme.css`) and existing Tailwind token mappings.
- Hardcoded values are only allowed when no token exists and a follow-up token addition is included in the same change.
- Any temporary hardcoded value must be explicitly annotated with `// ds-ignore` and linked to a cleanup ticket.

---

## Component API Policy

- Component variants must use clear canonical names:
  - `size`
  - `tone`
  - `intent`
  - `state`
- Components must follow established local patterns:
  - CVA for variants
  - `React.forwardRef`
  - `cn()` merge utility
  - optional `show?` and `disabledText?` when applicable
- Breaking API changes are prohibited unless accompanied by a migration note and release entry.
- Deprecations must be marked with JSDoc `@deprecated`, with a replacement path and target removal version.

---

## i18n Policy

- `packages/ui` must not hardcode user-facing strings.
- Components must accept translated strings as props from callers.
- `packages/ui` must not import or own app-level i18n libraries or translation key lookup.
- ARIA labels, placeholders, tooltips, and empty/error copy follow the same rule: caller-provided text.

---

## Release Policy

- `packages/ui` follows semantic versioning.
- No breaking changes without:
  - a migration section in release notes/changelog
  - explicit callouts in PR description
- Every PR that changes component behavior or API must include a changelog entry.

---

## Compliance and Exceptions

- CI checks enforce token and i18n rules for design-system surfaces.
- Reviewers should reject changes that violate this contract unless an approved exception is documented.
- Exception requests must include:
  - reason the contract cannot be followed
  - scope of exception
  - planned removal timeline
