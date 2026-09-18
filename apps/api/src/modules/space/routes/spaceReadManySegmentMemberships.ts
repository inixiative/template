/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:segment
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { segmentMembershipSchema } from '#/modules/segment/schemas/segmentSchemas';

export const spaceReadManySegmentMembershipsRoute = readRoute({
  model: Modules.space,
  submodel: Modules.segmentMembership,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('SegmentMember') },
  responseSchema: segmentMembershipSchema,
  middleware: [validatePermission('read')],
});
