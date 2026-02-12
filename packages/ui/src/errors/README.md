# UI Error Handling Strategy

This folder documents how we communicate errors and status to users across apps.

## Goals

- Be clear, fast, and consistent.
- Avoid noisy duplicate notifications.
- Use the least disruptive UI that still helps the user recover.

## Preferred Patterns

1. Toasts (transient feedback)
- Use for async operation results (save, update, delete, background action).
- Success toast duration: `3000ms`.
- Error toast duration: persistent (do not auto-dismiss).

2. Inline errors (local context)
- Use for form validation and component-local failures.
- Keep the message close to the input or control that failed.
- Include a direct fix path when possible.

3. Section/page error states
- Use when critical data for a view fails to load.
- Show retry action and enough context to proceed.

4. Error boundaries (render/runtime failures)
- Use for component tree crashes, not normal API validation failures.
- Prefer route/root-level boundaries for broad coverage.
- Add narrower boundaries only around high-risk widgets.

## What Not To Do

- Do not toast every successful query fetch.
- Do not rely on error boundaries for all async API errors.
- Do not show both a blocking page error and repeated global toasts for the same failure.

## Baseline Implementation Plan

1. API layer throws on errors by default.
2. Query client handles global async error toasts using `toast` utility.
3. Route/root boundaries handle runtime rendering crashes.
4. Forms and local components keep inline validation/errors.

## Toast Usage

Import from `@template/ui/lib/toast`:

```typescript
import { toast } from '@template/ui/lib/toast';

// Auto-dismisses after 3s
toast.success('Organization created');

// Persists until manually closed
toast.error('Failed to save changes');

// Auto-dismisses after 6s (double time)
toast.warning('Session expiring soon');

// Auto-dismisses after 3s
toast.info('Processing in background');
```

The `Toaster` component is already mounted in each app's root layout.

## Backend Error Contract

All API errors follow this standardized shape:

```typescript
type ApiErrorBody = {
  error: 'RESOURCE_NOT_FOUND' | 'VALIDATION_ERROR' | 'SERVER_ERROR' | ...; // Stable label
  message: string; // User-safe message
  guidance: 'fixInput' | 'tryAgain' | 'reauthenticate' | 'requestPermission' | 'refreshAndRetry' | 'contactSupport';
  fieldErrors?: Record<string, string[]>; // Present for validation errors
  requestId: string; // Always present for support/tracing
};
```

**Guidance determines UI behavior:**
- `fixInput` → Inline error + form validation
- `tryAgain` → Transient toast with retry button
- `reauthenticate` → Redirect to login
- `requestPermission` → Permission error + contact support CTA
- `refreshAndRetry` → Prompt to refresh page
- `contactSupport` → Persistent error toast + support CTA

**Types:**
- Import from `@template/shared/errors`
- Error labels and guidance values are derived from `HTTP_ERROR_MAP`
- All supported status codes: 400, 401, 403, 404, 405, 409, 410, 413, 415, 422, 429, 500, 502, 503, 504
