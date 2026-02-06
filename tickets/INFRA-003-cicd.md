# INFRA-003: CI/CD Pipeline (Review Branch Strategy)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Implement CI/CD pipeline using GitHub Actions with review branch deployment strategy instead of traditional YAML-based workflows. Support automatic preview environments for PR branches on Render.

## Key Components

- **GitHub Actions**: Test, build, deploy workflows
- **Review branches**: Automatic PR preview deploys
- **Branch strategy**:
  - `main` → production
  - `staging` → staging environment
  - `feature/*` → review apps (temporary)
- **Render integration**: Deploy via API, not YAML
- **Environment promotion**: Staging → Production workflow

## Tasks (High-Level)

- [ ] Test workflow (lint, type-check, unit tests, e2e)
- [ ] Build workflow (compile, bundle, optimize)
- [ ] Deploy workflow (staging, production, review apps)
- [ ] Database migrations (run before deploy)
- [ ] Rollback strategy
- [ ] Secrets management (Doppler integration)

## Reference

- User note: "We have branching for review branches, we won't be using a YAML"
- Render review apps: https://render.com/docs/preview-environments

## Related Tickets

- **Blocked by**: INFRA-001 (Init script for Render setup)
- **Blocks**: None

---

_Stub ticket - expand when prioritized_
