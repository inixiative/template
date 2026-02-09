# INFRA-003: CI/CD Pipeline (Decision + Baseline)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-02-07

---

## Overview

Define CI/CD approach after hosting/platform decisions are finalized at work. Keep this ticket focused on decision capture and baseline quality gates, then implement once the target platform pattern is confirmed.

## Current Context

- Existing `.github/workflows/ci.yml` may be accidental / temporary.
- Deployment strategy is intentionally deferred until patterns are validated in production at work.
- We still need battle-tested baseline checks and explicit anti-cruft rules.

## Phase 1: Decision Capture (Now)

- [ ] Document approved platform topology (host, DB, env/secrets, preview strategy)
- [ ] Decide whether CI lives in GitHub Actions, platform-native pipelines, or hybrid
- [ ] Decide if review environments are required for each PR
- [ ] Decide migration strategy (deploy-time, job runner, or manual gate)
- [ ] Decide rollback policy (app rollback + migration rollback/fix-forward)

## Phase 2: Baseline Guardrails (Before full CD)

- [ ] Keep `lint`, `typecheck`, and `test` green in CI
- [ ] Add explicit ownership for CI files and scripts
- [ ] Add a "no untracked generated artifacts" check
- [ ] Add a "no experimental scripts in production paths" check

## Open Questions

- Should `.github/workflows/ci.yml` stay, be replaced, or be removed?
- If using platform-native deploys, which checks still run in GitHub?
- Do we gate deploys on e2e, or only on smoke + migrations?

## References

- Render preview environments: https://render.com/docs/preview-environments

## Related Tickets

- **Blocked by**: INFRA-001 (Init script for Render setup)
- **Related**: INFRA-005 (Platform baseline selection)
- **Related**: FE-001 (TanStack Start evaluation)
- **Blocks**: None

---

_Decision-first ticket. Implement after platform choice is finalized._
