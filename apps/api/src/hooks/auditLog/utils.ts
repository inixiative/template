import { filterIgnoredFields, redactSensitiveFields } from '@template/db/lib/hooks';
import { isEqual } from 'lodash-es';

/** Maps model name → subject FK field(s) on AuditLog */
export const MODEL_TO_SUBJECT_FK: Partial<Record<string, string | string[]>> = {
  User: 'subjectUserId',
  Organization: 'organizationId',
  OrganizationUser: ['organizationId', 'subjectUserId'],
  Space: 'spaceId',
  SpaceUser: ['organizationId', 'spaceId', 'subjectUserId'],
  Token: 'subjectTokenId',
  AuthProvider: 'subjectAuthProviderId',
  Inquiry: 'subjectInquiryId',
  Account: 'subjectAccountId',
  Session: 'subjectSessionId',
  Verification: 'subjectVerificationId',
  CronJob: 'subjectCronJobId',
  EmailTemplate: 'subjectEmailTemplateId',
  EmailComponent: 'subjectEmailComponentId',
  CustomerRef: 'subjectCustomerRefId',
};

/**
 * Build the subject FK fields for a record.
 * For composite FK models (OrganizationUser, SpaceUser), reads multiple fields from the record.
 * For single FK models, uses record.id.
 */
export const buildSubjectFkFields = (
  model: string,
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const fk = MODEL_TO_SUBJECT_FK[model];
  if (!fk) return {};

  if (model === 'OrganizationUser') {
    return {
      organizationId: record.organizationId,
      subjectUserId: record.userId,
    };
  }
  if (model === 'SpaceUser') {
    return {
      organizationId: record.organizationId,
      spaceId: record.spaceId,
      subjectUserId: record.userId,
    };
  }
  if (model === 'Organization') {
    return { organizationId: record.id };
  }
  if (model === 'Space') {
    return { spaceId: record.id };
  }
  return { [fk as string]: record.id };
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
