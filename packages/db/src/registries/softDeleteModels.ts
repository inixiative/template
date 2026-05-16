/**
 * Models that are deleted via soft-delete semantics (set `deletedAt`, never
 * `DELETE FROM`). Single source of truth — the `preventHardDelete` hook reads
 * this set and throws on any `delete` / `deleteMany` call against a member.
 *
 * Two inputs:
 *   - AUDIT_ENABLED_MODELS: every audit-enabled model MUST be soft-delete
 *     (audit FKs can't survive a hard-delete — they'd either cascade and
 *     wipe history or SetNull and lose linkage). Declaring a model
 *     audit-enabled automatically enrolls it here, by construction. No
 *     separate sync to drift out of.
 *   - SOFT_DELETE_ONLY: models that need soft-delete but are not audited
 *     (e.g. high-volume domain entities where audit would be too noisy
 *     but physical deletion is still undesirable).
 *
 * Hard-delete must go through raw SQL (`db.$executeRaw`) which bypasses
 * Prisma hooks entirely. There is no Prisma-level escape hatch by design.
 * GDPR / right-to-be-forgotten goes through the redact service (anonymise
 * in place); Prisma deletes never happen on these models.
 */

import { AUDIT_ENABLED_MODELS } from '@template/db/registries/auditEnabledModels';

const SOFT_DELETE_ONLY = ['Contact', 'Tag', 'TagAttachment', 'TagCategory'] as const;

export const SOFT_DELETE_MODELS: readonly string[] = [...AUDIT_ENABLED_MODELS, ...SOFT_DELETE_ONLY];

export const SOFT_DELETE_MODEL_SET = new Set<string>(SOFT_DELETE_MODELS);

export const isSoftDeleteModel = (model: string): boolean => SOFT_DELETE_MODEL_SET.has(model);
