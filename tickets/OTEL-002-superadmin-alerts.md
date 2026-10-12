# OTEL-002 — Superadmin alerts

**Status:** draft · **Line:** OTEL · **Related:** OTEL-001, INFRA-005, [LOGGING.md](../docs/claude/LOGGING.md)

## Problem

The monitoring foundation (LOGGING.md) emits structured logs, traces and metrics, but nothing turns them into incidents inside the app. No external alert or notification is configured.

## Proposal

Make actionable incidents visible to superadmins without binding domain logic to one provider.

- **Signal queries.** A small contract with stable signal names and typed results, and enforced time/row limits on named, parameter-validated queries. A provider query adapter (e.g. New Relic NRQL) is one implementation; database/domain state is another. Log search can supply evidence links without becoming the rule engine. A failed or empty query reports **unknown**, not healthy. Results carry enough provenance to explain when and how the signal was observed. Arbitrary superadmin query exploration is a separate capability.
- **Incidents.** Persist incidents with a deduplication key, current state, first/last observed times, severity, assignee and evidence links. Rule configuration, evaluations, incidents and delivery attempts are separate records. Incident state changes go in the AuditLog.
- **Evaluation and delivery.** Evaluate with existing jobs; publish incident transitions through app events so the superadmin inbox, email and other channels stay independent. Use minimum sample counts, consecutive breaches, cooldowns and recovery conditions. Track delivery failures durably — an alert that cannot notify anyone is itself operational.
- **Access.** Platform-superadmin authorization on configuration and queries. The dashboard shows unknown/stale alongside firing and resolved.

## First slice

One rule (e.g. a background job exhausts its retries), the incident lifecycle (acknowledge, assign, resolve), a superadmin list/detail view, evidence links, and one existing delivery channel. Provider-native alerts keep handling infrastructure thresholds; the app owns product-specific incidents.

## Open questions

- The first rule, its threshold and window, and who receives it.
- Whether provider-native alerts open app incidents through authenticated webhooks, or scheduled evaluations are enough.
