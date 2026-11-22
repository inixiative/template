# INFRA-050: Signet and KCP-backed init provisioning

**Status**: 🆕 Not Started
**Priority**: Low/Medium
**Created**: 2026-11-21
**Related**: [INFRA-001](./INFRA-001-init-script.md), [INFRA-009](./INFRA-009-adapter-primitives.md), `R-2026-11-21-01`

## Why (Aron, 2026-11-21)

Today `bun run init` asks a developer to paste provider tokens into `init/components/TokenInputView.tsx` and the setup views (`PlanetScaleSetupView.tsx`, `RailwaySetupView.tsx`, `CloudflarePagesSetupView.tsx`, `ResendSetupView.tsx`, `BouncerSetupView.tsx`), or to sign into separate CLIs (`infisical`, `railway`, `vercel`, `gh`). Headless `init/agent.ts` reads those same tokens from environment variables and writes them into Infisical via `setSecretAsync` in `init/tasks/infisicalSetup.ts`.

Aron's direction (2026-11-21): let `init` optionally reuse Kingdom Signets through KCP (the Kingdom CLI Proxy) so users already signed into Kingdom do not paste six provider tokens into `TokenInputView` and per-provider setup prompts. Standalone open-source `template` users keep direct token entry with zero Kingdom dependency.

Under `R-2026-11-21-01`, the stateless provider clients move into `@inixiative/infra` so `template/init` and Kingdom share one driver layer instead of keeping parallel copies.

## Architecture

### Shared stateless clients (`@inixiative/infra`)

- Extract stateless hosting and infrastructure API clients into a standalone MIT package, `@inixiative/infra` (`R-2026-11-21-01`).
- Start with compute and hosting providers (Railway, Render, Fly.io, Firecracker, plus cloud providers behind the same contract).
- Move the remaining providers currently implemented in `init/api/` and listed in `init/providers.ts` onto the same package over time: `vercel.ts`, `cloudflare.ts`, `planetscale.ts`, `infisical.ts`, `infisicalRailway.ts`, `infisicalVercel.ts`, `resend.ts`, and `github.ts`.

### Provider executor in `init/tasks/`

Every setup task in `init/tasks/` (`railwaySetup.ts`, `railwayPostgresSetup.ts`, `railwayBucketsSetup.ts`, `vercelSetup.ts`, `cloudflarePagesSetup.ts`, `planetscaleSetup.ts`, `infisicalSetup.ts`, `resendSetup.ts`, `bouncerSetup.ts`) and `init/agent.ts` accepts a provider executor instead of calling raw token-reading clients directly:

1. **Direct mode (default, standalone):** Calls `@inixiative/infra` directly on the user's machine with tokens collected from `init/components/TokenInputView.tsx`, per-provider setup views, local CLI auth files, or environment variables. Requires no Kingdom account and adds no Kingdom dependency to `template`.
2. **Signet / KCP mode (opt-in):** Activates when KCP (`@inixiative/kcp`) is authenticated and holds matching Signets for the target providers. Forwards each provisioning operation through `@inixiative/kcp` to Kingdom, which runs the same `@inixiative/infra` driver server-side with Kingdom-held credentials. No provider tokens sit on the user's laptop.

### Current `init/` touchpoints

| Path | Role today | Change under this ticket |
|---|---|---|
| `init/providers.ts` | Declares frontend, database, backend, Redis, and email provider options | Keep as the provider catalog; map each provider id to its `@inixiative/infra` driver and KCP operation family |
| `init/api/*.ts` | Hand-written API and CLI wrappers (`railway.ts`, `vercel.ts`, `cloudflare.ts`, `planetscale.ts`, `infisical.ts`, `infisicalRailway.ts`, `infisicalVercel.ts`, `resend.ts`, `github.ts`) | Replace with `@inixiative/infra` drivers in direct mode and KCP transport adapters in Signet mode |
| `init/components/TokenInputView.tsx` and `init/views/*SetupView.tsx` | Collect provider tokens and save them to Infisical | Skip token prompts for providers backed by a held Signet; keep direct token entry for standalone runs and uncovered providers |
| `init/tasks/*Setup.ts` and `init/agent.ts` | Orchestrate provisioning steps and progress flags | Depend on the provider executor interface rather than importing token-coupled API singletons |

## Dependencies / Prerequisites

- `@inixiative/infra` package (`R-2026-11-21-01`) publishing stateless drivers for the providers `init/tasks/` calls.
- Kingdom splitting `kingdom/packages/integrations` from `kingdom/packages/access` (`R-2026-11-21-01`) and exposing server-side provisioning operations on those integrations.
- `@inixiative/kcp` command/operation execution (today KCP implements `login`, `status`, and `map`; running provider operations through Kingdom is in progress).

## To work out

1. **Signet scoping before a Kingdom Project exists.** KCP filters held Signets by Kingdom Project via `.foundry/kcp.json`, while Signets tied to no project remain usable across repos. On a fresh `template` fork, no Kingdom Project exists yet. Decide whether `init` uses an org-level or account-level Signet with no project restriction, creates the Kingdom Project first as an optional step, or asks Kingdom for a short-lived bootstrap Signet scoped to the new repo.
2. **Per-provider fallback in mixed stacks.** A user may hold Kingdom Signets for Railway, Vercel, and Cloudflare while using direct tokens for PlanetScale, Resend, or Bouncer. Define how `init` probes KCP for covered providers during `init/views/Prerequisites.tsx`, shows per-provider transport (`KCP` or `Direct`) in `init/views/MainMenu.tsx`, and falls back to `TokenInputView` or view prompts for uncovered providers.
3. **Cross-provider secret handoff without exposing secrets locally.** Today `init/api/infisicalRailway.ts` (`createRailwayConnection`), `init/api/infisicalVercel.ts`, `init/tasks/planetscaleSetup.ts`, and `init/tasks/railwaySetup.ts` read provider tokens or generated connection URLs on the laptop and push them into Infisical. In Signet / KCP mode, the laptop never holds the Railway or Vercel tokens. Decide how Kingdom performs that handoff server-side (for example, a Kingdom operation that writes generated connection values or Infisical app-connection syncs directly between two held Signets) so secrets never cross the laptop, stdout, argv, or `.env.init`.
4. **Zero-dependency KCP detection in `template`.** Standalone `template` must not depend on Kingdom packages in `package.json`. Decide whether `init` shells out to the local `kcp` binary over JSON stdio or loads `@inixiative/kcp` dynamically only when present on the machine.

## Definition of Done

- [ ] `init/tasks/` and `init/agent.ts` execute provider calls through a transport interface with a direct `@inixiative/infra` implementation and an opt-in KCP/Signet implementation.
- [ ] Standalone `bun run init` and `bun run init:agent` work with no KCP installation and no Kingdom account.
- [ ] When KCP is signed in with held Signets for a provider, `init` skips token entry for that provider and executes provisioning server-side through Kingdom without writing provider tokens to disk or printing secrets.
- [ ] Mixed stacks fall back cleanly per provider between KCP mode and direct token entry.
- [ ] `bun run test:init` covers both direct mode and mocked KCP transport mode.
