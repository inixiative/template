/**
 * @atlas
 * @kind route
 * @partOf feature:segment
 * @uses primitive:routeTemplates, primitive:authz
 */
import { SegmentMemberScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { segmentMemberCreateBodySchema } from '#/modules/segment/schemas/segmentSchemas';
import { Tags } from '#/modules/tags';

export const segmentCreateSegmentMemberRoute = createRoute({
  model: Modules.segment,
  submodel: Modules.segmentMember,
  bodySchema: segmentMemberCreateBodySchema,
  responseSchema: SegmentMemberScalarSchema,
  middleware: [validatePermission('manage')],
  tags: [Tags.segment, Tags.segmentMember],
});
