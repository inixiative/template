# INFRA-005: Platform Baseline (Hosting + DB + Observability)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-07
**Updated**: 2026-02-07

---

## Overview

Select a low-friction, production-safe baseline stack for hosting, database, and logging/observability. This ticket is about making one clear default path for the template.

## Decision Scope

- App hosting: Render vs Vercel (or split by app type)
- Primary database: managed Postgres provider (Render Postgres vs Supabase Postgres)
- Optional alternatives: Turso / Convex (only if they fit template constraints)
- Observability/logging baseline: managed vs self-hosted

## Tasks

- [ ] Define decision criteria (speed, cost floor, operational burden, lock-in risk, local-dev parity)
- [ ] Pick default hosting + DB combo for this template
- [ ] Define optional "advanced" alternatives (non-default)
- [ ] Define observability baseline:
  - [ ] Logs
  - [ ] Traces/metrics
  - [ ] Error tracking
- [ ] Capture migration/backup story for chosen DB
- [ ] Update docs and setup scripts to reflect chosen defaults

## Constraints

- Prefer boring + battle-tested over novel + clever
- Keep setup under 30 minutes for first deploy
- Avoid platform combinations that force rewrites in auth/jobs/websockets

## Definition of Done

- [ ] One default stack documented
- [ ] One optional alternative path documented
- [ ] CI/CD ticket updated with concrete platform assumptions
- [ ] Setup docs/scripts match selected stack

## Related Tickets

- INFRA-003 (CI/CD decision + baseline)
- OTEL-001 (Observability infrastructure)

