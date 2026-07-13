/**
 * @atlas
 * @kind utils
 * @uses infrastructure:prisma
 */
import { filterFields, getPolymorphismConfig, NOOP_FIELDS, redactSensitiveFields } from '@template/db';
import { isEqual } from 'lodash-es';

const getSubjectFieldValue = (model: string, field: string, record: Record<string, unknown>) => {
  switch (field) {
    case 'subjectOrganizationId':
      return model === 'Organization' ? record.id : record.organizationId;
    case 'subjectSpaceId':
      return model === 'Space' ? record.id : record.spaceId;
    case 'subjectUserId':
      return model === 'User' ? record.id : record.userId;
    default:
      return record.id;
  }
};

export const buildContextFkFields = (model: string, record: Record<string, unknown>): Record<string, unknown> => {
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

export const buildSubjectFkFields = (model: string, record: Record<string, unknown>): Record<string, unknown> => {
  const subjectAxis = getPolymorphismConfig('AuditLog')?.axes.find((axis) => axis.field === 'subjectModel');
  const fkFields = subjectAxis?.fkMap[model as keyof typeof subjectAxis.fkMap];
  if (!fkFields?.length) return {};

  const subjectFields: Record<string, unknown> = {};
  for (const field of fkFields) {
    const value = getSubjectFieldValue(model, field, record);
    if (value !== undefined) subjectFields[field] = value;
  }
  return subjectFields;
};

// Drops noop keys only — no redaction. buildAuditEntry diffs on this so a change touching only a
// sensitive field is still detected; redacting first masks both sides to the same token and the
// change vanishes under the empty-diff guard.
export const filterForAudit = (model: string, data: Record<string, unknown>): Record<string, unknown> =>
  filterFields(model, data, NOOP_FIELDS) as Record<string, unknown>;

// Filtered + redacted snapshot (before/after JSON) — also used by the email-versioning hook.
export const processAuditData = (model: string, data: Record<string, unknown>): Record<string, unknown> =>
  redactSensitiveFields(model, filterForAudit(model, data));

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
