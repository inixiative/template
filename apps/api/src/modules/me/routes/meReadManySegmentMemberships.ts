/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { segmentMembershipSchema } from '#/modules/segment/schemas/segmentSchemas';
import { Tags } from '#/modules/tags';

export const meReadManySegmentMembershipsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.segmentMembership,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('SegmentMember') },
  responseSchema: segmentMembershipSchema,
  tags: [Tags.me, Tags.segment],
});
