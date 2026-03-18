import { filterIgnoredFields, getPolymorphismConfig, redactSensitiveFields } from '@template/db';
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
    return { contextOrganizationId: record.id ?? null, contextSpaceId: null };
  }

  if (model === 'Space') {
    return {
      contextOrganizationId: record.organizationId ?? null,
      contextSpaceId: record.id ?? null,
    };
  }

  return {
    contextOrganizationId: record.organizationId ?? null,
    contextSpaceId: record.spaceId ?? null,
  };
};

export const buildSubjectFkFields = (
  model: string,
  record: Record<string, unknown>,
): Record<string, unknown> => {
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

export const processAuditData = (model: string, data: Record<string, unknown>): Record<string, unknown> => {
  const filtered = filterIgnoredFields(model, data);
  return redactSensitiveFields(model, filtered as Record<string, unknown>);
};

export const computeDiff = (
  model: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> => {
  const processedBefore = processAuditData(model, before);
  const processedAfter = processAuditData(model, after);
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(processedBefore), ...Object.keys(processedAfter)]);
  for (const key of allKeys) {
    if (!isEqual(processedBefore[key], processedAfter[key])) {
      diff[key] = { before: processedBefore[key], after: processedAfter[key] };
    }
  }
  return diff;
};
