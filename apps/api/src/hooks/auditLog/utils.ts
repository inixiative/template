/**
 * @atlas
 * @kind utils
 * @uses infrastructure:prisma
 */
import {
  maskSensitiveFields,
  NOOP_FIELDS,
  omitRegisteredFields,
  Prisma,
  polymorphicArmKeys,
  polymorphicKeyColumns,
} from '@template/db';
import type { AuditActor } from '@template/db/lib/auditActorContext';
import { isEqual } from 'lodash-es';

export const auditActorColumns = (actor: AuditActor | null) => ({
  actorUserId: actor?.actorUserId ?? null,
  actorSpoofUserId: actor?.actorSpoofUserId ?? null,
  actorTokenId: actor?.actorTokenId ?? null,
  actorJobName: actor?.actorJobName ?? null,
  actorIntegrationId: actor?.integrationId ?? null,
  actor: (actor?.actor as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
  ipAddress: actor?.ipAddress ?? null,
  userAgent: actor?.userAgent ?? null,
  sourceInquiryId: actor?.sourceInquiryId ?? null,
});

export const buildContextFkFields = (
  model: string,
  record: Record<string, unknown>,
): Record<string, unknown> => {
  if (model === 'Organization') {
    return { contextOrganizationId: record.id ?? null, contextSpaceId: null, contextUserId: null };
  }

  if (model === 'Space') {
    return {
      contextOrganizationId: record.organizationId ?? null,
      contextSpaceId: record.id ?? null,
      contextUserId: null,
    };
  }

  return {
    contextOrganizationId: record.organizationId ?? null,
    contextSpaceId: record.spaceId ?? null,
    contextUserId: record.userId ?? null,
  };
};

/** The subject columns of an audit entry: its dual id always, its typed keys unless the subject is gone. */
export const buildSubjectColumns = (
  model: string,
  record: Record<string, unknown>,
  { withKeys }: { withKeys: boolean } = { withKeys: true },
): Record<string, unknown> => ({
  subjectId: typeof record.id === 'string' ? record.id : null,
  ...(withKeys && polymorphicKeyColumns('AuditLog', 'subjectModel', model).length
    ? polymorphicArmKeys('AuditLog', 'subjectModel', model, record)
    : {}),
});

export const omitNoopFieldsForAudit = (
  model: string,
  data: Record<string, unknown>,
): Record<string, unknown> =>
  omitRegisteredFields(model, data, NOOP_FIELDS) as Record<string, unknown>;

export const maskSensitiveAndOmitNoopFieldsForAudit = (
  model: string,
  data: Record<string, unknown>,
): Record<string, unknown> => maskSensitiveFields(model, omitNoopFieldsForAudit(model, data));

export const computeDiff = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> => {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (!isEqual(before[key], after[key])) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }
  return diff;
};
