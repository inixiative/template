import type { Prisma } from '@template/db';
import { includeAuditLogResponse } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';

const includeAuditLogNested = {
  include: includeAuditLogResponse,
  orderBy: { id: 'asc' },
} as const satisfies Prisma.AuditLogFindManyArgs;

export const includeInquiryResponse = {
  sourceUser: true,
  sourceOrganization: true,
  sourceSpace: true,
  targetUser: true,
  targetOrganization: true,
  targetSpace: true,
  auditLogsAsSubject: includeAuditLogNested,
} as const satisfies Prisma.InquiryInclude;

export const includeInquirySent = {
  targetUser: true,
  targetOrganization: true,
  targetSpace: true,
  auditLogsAsSubject: includeAuditLogNested,
} as const satisfies Prisma.InquiryInclude;

export const includeInquiryReceived = {
  sourceUser: true,
  sourceOrganization: true,
  sourceSpace: true,
  auditLogsAsSubject: includeAuditLogNested,
} as const satisfies Prisma.InquiryInclude;
