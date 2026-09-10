/**
 * @atlas
 * @kind route
 * @partOf feature:segment
 * @uses primitive:routeTemplates, primitive:authz
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { segmentMemberWithCustomerSchema } from '#/modules/segment/schemas/segmentSchemas';
import { Tags } from '#/modules/tags';

export const segmentReadManySegmentMembersRoute = readRoute({
  model: Modules.segment,
  submodel: Modules.segmentMember,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('SegmentMember') },
  responseSchema: segmentMemberWithCustomerSchema,
  middleware: [validatePermission('read')],
  tags: [Tags.segment, Tags.segmentMember],
});
