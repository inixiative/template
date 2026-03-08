# A11y Baseline

Accessibility baseline requirements for design-system components.

## Contents

- [Interactive Components](#interactive-components)
- [Form Controls](#form-controls)
- [Icon-Only Interactions](#icon-only-interactions)
- [Error Messaging](#error-messaging)
- [ARIA and i18n](#aria-and-i18n)
- [Verification Checklist](#verification-checklist)

---

## Interactive Components

All interactive components must provide:
- full keyboard navigation
- visible focus ring/focus indication
- correct ARIA roles and semantics

Implementation rule:
- Prefer Ariakit primitives/patterns for accessible behavior in complex controls.

---

## Form Controls

All form controls must support proper label wiring:
- control has an `id`
- visual label uses `htmlFor` pointing to that `id`
- helper/error text is connected via `aria-describedby` where appropriate

Composition should be handled through the shared `FormField` pattern to keep wiring consistent.

---

## Icon-Only Interactions

All icon-only actionable elements must have an accessible name:
- require `aria-label` or `aria-labelledby`
- title text alone is not sufficient

Review check:
- if no visible text is present, a localized accessible name must be provided.

---

## Error Messaging

Validation or submission errors must be announced to assistive tech:
- use `role="alert"` for urgent error messages
- use `aria-live="polite"` for non-blocking status updates

Error states must also expose `aria-invalid` on invalid form controls.

---

## ARIA and i18n

- ARIA labels/messages must be caller-provided and translated upstream.
- Do not hardcode English ARIA labels in `packages/ui`.
- Component APIs must accept label/message props to support localization.

---

## Verification Checklist

Before merging a new/changed component:
- Keyboard-only navigation works for all actions.
- Focus styles are visible and token-consistent.
- ARIA roles/states/properties are valid for the control pattern.
- Labels and descriptions are correctly associated.
- Error/status announcements are screen-reader discoverable.
