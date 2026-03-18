# INFRA-009: Adapter Primitive — Swappable External Services

**Status**: 🚧 In Progress
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-03-14
**Updated**: 2026-03-18

---

## Overview

> "Opinionated architecture, swappable infrastructure."

Define a consistent adapter pattern for all external service dependencies so teams can pick providers during `init` and swap later without touching application code.

Email is the only system that currently has the adapter pattern. Everything else is hard-coded to a specific provider SDK.

---

## The Adapter Primitive

Every external service gets:

1. **An interface** — what the application expects (e.g., `EmailClient.send()`)
2. **Adapter implementations** — one per provider, all conforming to the interface
3. **A factory** — reads config, returns the right adapter
4. **Init script integration** — `init` asks which provider, sets env vars, installs the SDK

```
Application Code → Interface → Factory → Adapter → Provider SDK
```

Application code never imports a provider SDK directly. It imports the interface.

---

## Current State

| System | Has Interface? | Has Adapter Pattern? | Hard-coded To |
|--------|---------------|---------------------|---------------|
| Email | **Yes** (`EmailClient`) | **Yes** (Resend, Console) | — |
| Error Monitoring | **Yes** (`ErrorReporter`) | **Yes** (Sentry, Console) | — |
| Logger | No | No | Consola |
| File Storage | No | No | AWS S3 |
| Payments | No | No | Stripe |
| Secrets | N/A (deployment tool) | N/A | Infisical |

---

## Scope

### Tier 1 — High Value, Low Effort

#### Logger
**Interface:** `Logger` with standard methods + scope support + ALS context injection
**Adapters:**
- `consola` (default — best DX for development)
- `pino` (production — async worker thread, JSON output, Datadog/ELK ready)
- `winston` (legacy — for teams already using it)

**Why:** Most debated choice in the template. Making it swappable ends the conversation.

#### Error Monitoring
**Interface:** `ErrorReporter` with `captureException(error, context)` and `captureMessage(message, level)`
**Adapters:**
- `sentry` (default)
- `bugsnag`
- `datadog`
- `console` (development — just logs errors)

**Why:** Currently 2 lines of Sentry in the error middleware. Tiny surface area, easy to abstract.

---

### Tier 2 — High Value, Medium Effort

#### File Storage
**Interface:** `FileStorage` with `generateUploadUrl()`, `generateDownloadUrl()`, `delete()`
**Adapters:**
- `s3` (default — AWS)
- `r2` (Cloudflare — S3-compatible, cheaper)
- `gcs` (Google Cloud Storage)
- `minio` (self-hosted, S3-compatible)
- `local` (development — filesystem, no cloud dependency)

#### Payments
**Interface:** `PaymentProvider` with `createCheckout()`, `createSubscription()`, `handleWebhook()`, `refund()`
**Adapters:**
- `stripe` (default)
- `square` (physical + digital)
- `lemon-squeezy` (merchant of record — handles tax/compliance)
- `adyen` (enterprise, 250+ payment methods)

**Why:** Stripe-or-nothing is the #1 complaint about SaaS templates.

---

### Tier 3 — Nice to Have

#### Email (already done — add providers)
Interface exists. Just add: `sendgrid`, `postmark`, `ses`, `mailgun`

#### Secrets Management
Already swappable at the env layer. Add init script options:
- `infisical` (default), `doppler`, `vault`, `aws-secrets-manager`, `manual`

---

## Init Script Integration

```
┌─────────────────────────────────────────┐
│  Infrastructure Configuration           │
│                                         │
│  Logger:    ● Consola  ○ Pino           │
│  Email:     ● Resend   ○ Postmark       │
│  Storage:   ● S3       ○ R2   ○ Local   │
│  Payments:  ● Stripe   ○ Square  ○ None │
│  Errors:    ● Sentry   ○ Bugsnag        │
│  Secrets:   ● Infisical ○ Doppler       │
│                                         │
│  [ Configure ]                          │
└─────────────────────────────────────────┘
```

Init script then: installs chosen SDK, sets env vars, removes unused provider packages.

---

## Implementation Order

- [x] Define the base adapter primitive — `makeAdapterRouter` + `makeAdapterRegistry` in `packages/shared/src/adapter/`
- [x] Error monitoring — `apps/api/src/lib/errorReporter/` with `sentryReporter` + `consoleReporter`, wired via `makeAdapterRouter`
- [ ] Logger — highest-value swap, most debated choice
- [ ] File storage — removes AWS dependency for development
- [ ] Email additions — interface exists, just add providers
- [ ] Payments — biggest effort, biggest differentiator
- [ ] Init script integration — ties it all together

## Design Principles

- **Zero-cost abstraction** — factory runs once at startup, returns the concrete implementation
- **Type-safe** — swapping providers is a config change, not a type error hunt
- **Testable** — every system gets a `console`/`local`/`mock` adapter so tests need no external services
- **Progressive** — interface is the investment, not the adapter count
- **Init script is the UX** — developers shouldn't read docs to swap a provider

## Definition of Done

- [x] Adapter pattern implemented — `makeAdapterRouter` (env-keyed) + `makeAdapterRegistry` (named map) in `@template/shared/adapter`
- [ ] Logger adapter (consola + pino minimum)
- [x] Error monitoring adapter — `sentryReporter` + `consoleReporter`; PR environments included
- [ ] File storage adapter (s3 + local minimum)
- [ ] Init script presents adapter choices during setup
- [ ] All existing email adapters tested and confirmed working

## Related Tickets

- INFRA-001 (Init script)
- FEAT-009 (File management)
- FEAT-013 (Encryption)
- OTEL-001 (Observability infrastructure)
