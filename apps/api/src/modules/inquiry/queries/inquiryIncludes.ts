/**
 * @atlas
 * @kind query
 * @partOf feature:inquiry
 * @uses feature:auditLogs
 */
import type { Prisma } from '@template/db';
import { includeAuditLogResponse } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';

const includeAuditLogNested = {
  include: includeAuditLogResponse,
  orderBy: { id: 'asc' },
} as const satisfies Prisma.AuditLogFindManyArgs;

const withoutKeyHash = { omit: { keyHash: true } } as const;

// why: a list row shows who it acts on from either side: the party and every owner above it
const includeBothSides = {
  sourceUser: true,
  sourceOrganization: true,
  sourceSpace: true,
  sourceIntegration: true,
  sourceToken: withoutKeyHash,
  sourceProject: true,
  targetUser: true,
  targetOrganization: true,
  targetSpace: true,
  targetIntegration: true,
  targetToken: withoutKeyHash,
  targetProject: true,
} as const satisfies Prisma.InquiryInclude;

export const includeInquiryResponse = {
  ...includeBothSides,
  auditLogsAsSubject: includeAuditLogNested,
} as const satisfies Prisma.InquiryInclude;

export const includeInquirySent = includeInquiryResponse;

export const includeInquiryReceived = includeInquiryResponse;
