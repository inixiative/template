import { readRoute } from '#/lib/routeTemplates/read';
import { auditLogResponseSchema } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';
import { Modules } from '#/modules/modules';

export const auditLogReadManyRoute = readRoute({
  model: Modules.auditLog,
  many: true,
  paginate: true,
  admin: true,
  searchableFields: [
    'action',
    'subjectModel',
    'actorUserId',
    'actorSpoofUserId',
    'actorTokenId',
    'contextOrganizationId',
    'contextSpaceId',
    'sourceInquiryId',
    'subjectOrganizationId',
    'subjectSpaceId',
    'subjectUserId',
    'subjectInquiryId',
    'subjectTokenId',
    'subjectAuthProviderId',
    'subjectCustomerRefId',
    'ipAddress',
    'userAgent',
  ],
  responseSchema: auditLogResponseSchema,
});
