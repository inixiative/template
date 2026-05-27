# Adapter Modules

<!-- toc:start -->

## Contents

- [What an adapter module is](#what-an-adapter-module-is)
- [Module layout (Option β)](#module-layout-option-)
- [Adapter primitives](#adapter-primitives)
  - [makeAdapterRouter — pick-one per environment](#makeadapterrouter--pick-one-per-environment)
  - [makeBroadcastRegistry — fan-out across providers](#makebroadcastregistry--fan-out-across-providers)
  - [makeAdapterRegistry — named map](#makeadapterregistry--named-map)
- [Naming conventions](#naming-conventions)
- [Existing examples](#existing-examples)
- [When to create a new adapter module](#when-to-create-a-new-adapter-module)
- [What NOT to do](#what-not-to-do)

<!-- toc:end -->

---

Any module that wraps an **external service** (storage, email, error reporting, etc.) follows the **adapter pattern** documented here. The pattern keeps provider choice swappable, application code provider-ignorant, and env-aware behavior centralized.

The primitives live in `packages/shared/src/adapter/`. Existing reference implementations: `apps/api/src/lib/errorReporter/`, `apps/api/src/lib/storage/`, `packages/email/src/client/`.

---

## What an adapter module is

An adapter module exposes **one stable interface** to application code, and wraps one or more **provider implementations** behind it. Application code imports the interface — never a provider SDK directly.

Three concerns inside an adapter module:

1. **Interface (`types.ts`)** — what the application expects (e.g. `StorageClient.presignPost`). Provider-agnostic.
2. **Provider(s) (`client/<name>.ts`)** — concrete implementations of the interface (e.g. `createS3Client`). One file per provider.
3. **Wiring (`index.ts`)** — reads env vars, constructs providers, wraps in an adapter primitive, exports the chosen instance.

---

## Module layout (Option β)

This is the canonical structure. All new adapter modules follow it.

```
<moduleName>/
├── index.ts              # env reads + makeAdapterRouter → exports the adapter
├── types.ts              # The interface (role-based name: ErrorReporter, StorageClient, EmailClient)
└── client/
    ├── <provider1>.ts    # createXClient(config) — implements the interface
    └── <provider2>.ts    # createYClient(config) — alternate provider
```

Why `client/` as a subfolder:
- Pre-creates the seam for additional providers without restructuring.
- Single-provider modules sit in `client/` alone; the pattern doesn't change when a second provider lands.
- Matches `packages/email/src/client/` (the most recently refined example).

---

## Adapter primitives

All in `@template/shared/adapter`. Pick based on selection semantics.

### makeAdapterRouter — pick-one per environment

Use when: **one provider runs per environment**. The router selects by `process.env.ENVIRONMENT`. This is the default — most adapter modules.

```typescript
import { makeAdapterRouter } from '@template/shared/adapter';
import { createS3Client } from '#/lib/storage/client/s3';
import type { StorageClient } from '#/lib/storage/types';

const s3 = createS3Client({ /* env-derived config */ });

export const storage = makeAdapterRouter<StorageClient>({
  prod: s3,
  staging: s3,
  pr: s3,
  default: s3,
});
```

Even with a single provider, route through `makeAdapterRouter`. The seam exists for future env-divergent behavior (e.g., `test: noopStorage` later) without touching application code.

### makeBroadcastRegistry — fan-out across providers

Use when: **a single operation should hit multiple providers in parallel**. E.g., a message dispatched across all registered communication channels.

```typescript
import { makeBroadcastRegistry } from '@template/shared/adapter';

export const messageProviderRegistry = makeBroadcastRegistry<MessageProviderAdapter>();
// Providers register themselves at load:
messageProviderRegistry.register('email', emailAdapter);
messageProviderRegistry.register('sms', smsAdapter);
// Caller: messageProviderRegistry.broadcast(...) → all providers run via Promise.allSettled
```

Storage is not a fan-out concern — never use `makeBroadcastRegistry` for storage.

### makeAdapterRegistry — named map

Use when: **caller explicitly picks which provider** by name (not env-derived). Rare. See `packages/shared/src/adapter/registry.ts`.

---

## Naming conventions

| Element | Convention | Examples |
|---|---|---|
| Module folder | camelCase, role-suffixed | `errorReporter/`, `storage/`, `email/client/` |
| Interface type | Role-based, PascalCase | `ErrorReporter`, `StorageClient`, `EmailClient` |
| Provider factory | `create<Provider><Role>` | `createS3Client`, `createResendClient`, `createConsoleReporter` |
| Exported adapter | Module name (no role suffix) | `errorReporter`, `storage` |
| Module-level singleton | `__` prefix | `let __client: S3Client \| null = null` |

The `__` prefix is the template-wide convention for **internal/private** items (see `AI/ENTRYPOINT.md` and code-style memory). Never use a single `_` prefix for private — single `_` means "unused" in this codebase.

---

## Existing examples

| Module | Path | Primitive | Providers |
|---|---|---|---|
| Error reporting | `apps/api/src/lib/errorReporter/` | `makeAdapterRouter` | console, sentry |
| Storage | `apps/api/src/lib/storage/` | `makeAdapterRouter` | s3 (only) |
| Email | `packages/email/src/client/` | direct factory | console, resend |
| Messaging providers | `apps/api/src/lib/messaging/providers.ts` | `makeBroadcastRegistry` | per-channel |

Email uses a direct factory (`createConsoleClient`/`createResendClient`) instead of `makeAdapterRouter` because consumers pick the provider explicitly per email (different tenant orgs can have different API keys). Storage and errorReporter pick once per environment — hence the router.

---

## When to create a new adapter module

Wrap behind an adapter if any of the following:
- The thing talks to an **external service** (SaaS API, cloud SDK, third-party network resource)
- The implementation might **change per environment** (prod vs local vs test)
- You'd want to **mock it cleanly in tests**
- Another provider for the same role is plausible within 12 months

If none apply, skip the abstraction — just import the library directly. Adapters cost reading-cost; only pay it when there's a real swap concern.

---

## What NOT to do

- **Don't bake env reads into provider files.** Env vars belong in the module's `index.ts` only. Providers receive a typed config object.
- **Don't return a direct provider from `index.ts`.** Wrap through `makeAdapterRouter` for env-keyed selection, even if all envs map to the same provider today. The seam is the point.
- **Don't add a `noop` adapter as a registered provider.** Mocks belong at the interface level via `vi.mock()`. A `noop` adapter in the production registry is dishonest — production code could accidentally select it.
- **Don't include auth/permission logic in adapters.** Adapters are mechanical — they sign URLs, send bytes, talk to APIs. Policy (who can call what) lives at the route/middleware layer where permix is wired.
- **Don't use a `Map<config, client>` singleton when there's only one config.** That pattern (see `packages/email/src/client/resend.ts`) exists because email supports per-tenant API keys. For single-config adapters (storage, errorReporter), a plain `let __client = null` module-level singleton is correct.
- **Don't mix concerns into a single file.** Interface in `types.ts`, providers in `client/`, wiring in `index.ts`. Three files minimum, even for a single-provider module.
