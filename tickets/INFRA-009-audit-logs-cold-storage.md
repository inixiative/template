# INFRA-009: Audit Log Cold Storage

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-03-04

---

## Overview

Audit logs accumulate indefinitely and must remain queryable for compliance (SOC2, GDPR). At scale, hot Postgres storage becomes expensive and slow. This ticket covers shipping audit logs to cold storage before hot-deletion by the retention job.

## Goals

- Export audit logs to an external store (S3, ClickHouse, BigQuery, etc.) before hot deletion
- Maintain queryability for compliance audits and investigations
- Keep primary DB lean — hot storage only for recent logs (90 days default)

## Approach Options

- **S3 + Athena** — cheap, queryable via SQL, good for compliance exports
- **ClickHouse** — fast analytical queries, good for real-time dashboards
- **BigQuery / Snowflake** — if org already uses a data warehouse

## Tasks

- [ ] Choose cold storage target (decision: TBD)
- [ ] Build export job: batch export logs older than N days before deletion
- [ ] Update `cleanStaleAuditLogs` to export-then-delete (not just delete)
- [ ] Add env vars: `AUDIT_LOG_COLD_STORAGE_TARGET`, `AUDIT_LOG_EXPORT_BATCH_SIZE`
- [ ] Add monitoring/alerting on export failures
- [ ] Ensure export + deletion is atomic (no data loss on failure)
- [ ] Document compliance query patterns for common audit questions

## Related

- **INFRA-007**: Data Lifecycle (retention, export, delete)
- **FEAT-005**: Audit Logs (hot storage implementation)
- **OTEL-001**: Observability infrastructure

---

_Blocked by: FEAT-005_
