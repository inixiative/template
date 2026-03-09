import type { Db, Prisma } from '@template/db';
import { includeAuditLogResponse } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';

export const includeInquiryResponse = {
  sourceUser: true,
  sourceOrganization: true,
  sourceSpace: true,
  targetUser: true,
  targetOrganization: true,
  targetSpace: true,
} as const satisfies Prisma.InquiryInclude;

export const includeInquirySent = {
  targetUser: true,
  targetOrganization: true,
  targetSpace: true,
} as const satisfies Prisma.InquiryInclude;

export const includeInquiryReceived = {
  sourceUser: true,
  sourceOrganization: true,
  sourceSpace: true,
} as const satisfies Prisma.InquiryInclude;

type InquiryWithId = { id: string };
type AuditLogWithActors = Prisma.AuditLogGetPayload<{ include: typeof includeAuditLogResponse }>;

const dedupeAuditLogs = (auditLogs: AuditLogWithActors[]) => {
  const seen = new Set<string>();
  return auditLogs.filter((auditLog) => {
    if (seen.has(auditLog.id)) return false;
    seen.add(auditLog.id);
    return true;
  });
};

export const attachInquiryAuditLogs = async <T extends InquiryWithId>(db: Db, inquiry: T) => {
  const auditLogs = await db.auditLog.findMany({
    where: {
      OR: [{ sourceInquiryId: inquiry.id }, { subjectInquiryId: inquiry.id }],
    },
    include: includeAuditLogResponse,
    orderBy: { id: 'asc' },
  });

  return {
    ...inquiry,
    auditLogs: dedupeAuditLogs(auditLogs),
  };
};

export const attachInquiryAuditLogList = async <T extends InquiryWithId>(db: Db, inquiries: T[]) => {
  if (inquiries.length === 0) return [];

  const inquiryIds = inquiries.map((inquiry) => inquiry.id);
  const requestedIds = new Set(inquiryIds);
  const auditLogs = await db.auditLog.findMany({
    where: {
      OR: [{ sourceInquiryId: { in: inquiryIds } }, { subjectInquiryId: { in: inquiryIds } }],
    },
    include: includeAuditLogResponse,
    orderBy: { id: 'asc' },
  });

  const auditLogsByInquiryId = new Map<string, AuditLogWithActors[]>();
  for (const auditLog of auditLogs) {
    const relatedInquiryIds = new Set([auditLog.sourceInquiryId, auditLog.subjectInquiryId].filter(Boolean));
    for (const inquiryId of relatedInquiryIds) {
      if (!requestedIds.has(inquiryId)) continue;
      auditLogsByInquiryId.set(inquiryId, [...(auditLogsByInquiryId.get(inquiryId) ?? []), auditLog]);
    }
  }

  return inquiries.map((inquiry) => ({
    ...inquiry,
    auditLogs: dedupeAuditLogs(auditLogsByInquiryId.get(inquiry.id) ?? []),
  }));
};
