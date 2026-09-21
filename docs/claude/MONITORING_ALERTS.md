# Follow-up: superadmin alerts

This is a proposal for a second PR, not implemented alerting. The first PR establishes structured evidence and correlation. The second should make actionable incidents visible inside the app without binding domain logic to New Relic.

## What Zealot already contributes

Zealot's `packages/monitoring` has Bun-compatible fetch exporters, trace-linked structured logging and operation metrics. Its `apps/api/src/modules/admin/newRelic/services/newRelicQuery.ts` implements a query proxy: it requires SINCE and LIMIT clauses, caches by account/query for 60 seconds, rejects responses above 1 MB and emits a `newRelic.queried` event. The integration client bounds request time and checks HTTP and GraphQL errors. Its observability design distinguishes provider-owned infrastructure thresholds from application-owned domain rules and describes incident lifecycle and delivery responsibilities.

That proxy is worth retaining as a New Relic adapter. A query proxy alone is not an alert engine, and requiring clause keywords does not prove a query has a safe time/row budget. The template follow-up should offer named, parameter-validated signal queries with enforced limits; arbitrary superadmin exploration can remain a separate capability.

## Proposed first alert workflow

Start with one operational failure: a background job exhausts retries, or a WhatsApp bot remains disconnected beyond an agreed duration. A rule opens one incident; a superadmin sees the evidence and can acknowledge, assign, and resolve it. A failed/empty provider query becomes **unknown**, not healthy.

The provider boundary needs a small signal-query contract with stable signal names and typed results. New Relic NRQL is one adapter; database/domain state is another. Better Stack can supply log-search links without becoming the rule engine. Return enough provenance to explain when and how the signal was observed.

Persist incidents in the application with deduplication keys, current state, first/last observed times, severity, assigned user, and evidence links. Keep rule configuration, evaluations, incidents, and delivery attempts as separate responsibilities. Changes to incident state belong in AuditLog. Evaluate with existing jobs; publish incident transitions through app events so the superadmin inbox, email, or other delivery channels stay independent.

Use minimum sample counts, consecutive breaches, cooldowns, and recovery conditions. Track delivery failures durably; an alert that cannot notify anyone is itself operationally relevant. Protect configuration and query access with platform-superadmin authorization. Give the dashboard an explicit unknown/stale state alongside firing and resolved.

## Keep the scope understandable

The first alert PR should include one rule, incident lifecycle, a superadmin list/detail view, evidence links and one existing delivery channel. Avoid copying Zealot's entire lenses/rollups/query/MCP design at once. Native New Relic alerts can continue handling infrastructure thresholds; the app owns product-specific incidents and their workflow.

Before implementation, choose the first rule, its threshold/window, who should receive it, and whether provider-native alerts should create app incidents through authenticated webhooks or whether scheduled evaluations are sufficient. No external alert or notification has been configured by the monitoring foundation PR.
