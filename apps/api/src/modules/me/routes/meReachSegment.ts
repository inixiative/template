/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { actionRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { segmentReachBodySchema, segmentReachResponseSchema } from '#/modules/segment/schemas/segmentSchemas';
import { Tags } from '#/modules/tags';

export const meReachSegmentRoute = actionRoute({
  model: Modules.me,
  submodel: Modules.segment,
  action: 'reach',
  skipId: true,
  bodySchema: segmentReachBodySchema,
  responseSchema: segmentReachResponseSchema,
  description: 'Counts your customers a candidate segment rule matches today. Nothing is saved.',
  tags: [Tags.me, Tags.segment],
});
