# CI/CD

> Decision phase: deployment strategy intentionally deferred while platform patterns are validated.

## Contents

- [Overview](#overview)
- [GitHub Actions](#github-actions)
- [Deployment Environments](#deployment-environments)
- [Database Migrations](#database-migrations)

---

## Overview

Current state:
- No active CI workflow is committed in this repo.
- CI/CD implementation is tracked in `tickets/INFRA-003-cicd.md`.
- Platform baseline decision is tracked in `tickets/INFRA-005-platform-baseline-hosting-observability.md`.

---

## GitHub Actions

Not finalized.
- Option A: temporary quality-gate CI only (`lint`, `typecheck`, `test`)
- Option B: platform-native pipelines
- Option C: hybrid approach

---

## Deployment Environments

Not finalized.
- environment model and promotion flow will be documented after INFRA-005 decision.

See also: [ENVIRONMENTS.md](ENVIRONMENTS.md)

---

## Database Migrations

Not finalized.
- migration execution, safety checks, and rollback/fix-forward strategy are part of INFRA-003.
