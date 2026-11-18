/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import {
  segmentEstimateReachBodySchema,
  segmentEstimateReachResponseSchema,
} from '#/modules/segment/schemas/segmentSchemas';

export const meEstimateReachSegmentRoute = actionRoute({
  model: Modules.me,
  middleware: [validateSubmodelPermission('create')],
  submodel: Modules.segment,
  action: 'estimateReach',
  skipId: true,
  bodySchema: segmentEstimateReachBodySchema,
  responseSchema: segmentEstimateReachResponseSchema,
  description: 'Counts your customers a candidate segment rule matches today. Nothing is saved.',
  tags: [OpenApiTags.me, OpenApiTags.segment],
});
