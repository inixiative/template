# INFRA-039: Rule references — port Zealot's declaration table, plain sourceId, refusals that say why

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-10-23
**Updated**: 2026-10-23
**Related**: ZLT-6030, INFRA-030

---

## Overview

INFRA-030 built the edge table. Zealot (ZLT-5978) has since moved past it: one declaration table
of rule-bearing columns, one generic after-hook, and edges that read on their own. This brings the
template level with it.

## Rulings (Aron, 2026-10-23)

1. **Plain ids beside the false polymorphism.** `RuleReference` keeps its typed FKs and relations
   on both axes, and also carries plain `sourceId` and `targetId`. Edge identity is one unique,
   `(sourceModel, sourceId, targetModel, targetId)`, whatever the source model.
2. **Touching an invalid rule fails until it is valid.** A write to a rule column that names a dead
   or out-of-view row is refused, including a row the rule already named. The refusal lists each
   reference as `<model> '<label>' (deleted|missing)`. The `held` exemption in
   `assertSegmentReferencesOwned` is gone. A write that leaves the rule column alone is not a
   touch and still goes through.
3. **Reads carry their references.** The segment read returns
   `ruleReferences: [{ targetModel, targetId, targetLabel, targetDeletedAt }]` so the UI can say why
   a rule is degraded.
4. **One declaration table, one hook.** `RULE_REFERENCE_SURFACES` declares each storing model's
   columns, label, storage wrapper and lens. A single after-hook syncs edges for every model in it;
   revive regenerates by looping the same table. There are no per-source sync calls and no
   per-model switch.

## Items

- [x] **Schema**: `sourceId` on `RuleReference`, one unique replacing the three per-source uniques.
- [x] **Declaration table + generic hook**: `hooks/ruleReference/surfaces.ts` + `hook.ts`;
  `syncRuleReferenceEdges` stays the one edge writer.
- [x] **Target hook**: no `create` registration; `ruleReference.stale` app event deleted.
- [x] **Refuse with reasons**: no `held`; refusal names model, label and reason.
- [x] **Reads include references**: every segment response returns `ruleReferences`, with labels
  read through the label the customer-ref lens declares and batched per model.
- [x] **Agreement test**: lens identity models and `RuleReference` target columns agree
  (`hooks/ruleReference/registryAgreement.test.ts`). Every target column is reachable today, so
  there is no edge-free list.

## Notes

- **Labels in a refusal.** A reference the source already held, which was in view when it was
  saved, is named by its label. Any other reference is named by id, so a refusal never shows what
  another owner's row is called.

- **The degraded signal is read from edges, not published.** `ruleReference.stale` had no consumer.
  Its handler was empty. A reader that needs "which rules are degraded" asks the edges:
  `targetDeletedAt` set means the target was soft-deleted, and a null typed FK with `targetId` still
  set means it was purged (`ruleReferenceIssues`). An alert or a job counts those rows. It does not
  subscribe to an event.
- **No migration file.** The template has no migration history yet. The schema is applied with
  `db push`, and `db:baseline` refuses to run once any migration exists. A fork that has already
  cut its baseline migrates in three steps:

  ```sql
  ALTER TABLE "RuleReference" ADD COLUMN "sourceId" VARCHAR(36);
  UPDATE "RuleReference"
    SET "sourceId" = COALESCE("sourceEmailTemplateId", "sourceEmailComponentId", "sourceSegmentId");
  ALTER TABLE "RuleReference" ALTER COLUMN "sourceId" SET NOT NULL;
  DROP INDEX "RuleReference_sourceEmailTemplate_target_key";
  DROP INDEX "RuleReference_sourceEmailComponent_target_key";
  DROP INDEX "RuleReference_sourceSegment_target_key";
  CREATE UNIQUE INDEX "RuleReference_sourceModel_sourceId_targetModel_targetId_key"
    ON "RuleReference" ("sourceModel", "sourceId", "targetModel", "targetId");
  ```
