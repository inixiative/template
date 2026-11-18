/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:segment
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import {
  segmentEstimateReachBodySchema,
  segmentEstimateReachResponseSchema,
} from '#/modules/segment/schemas/segmentSchemas';

export const spaceEstimateReachSegmentRoute = actionRoute({
  model: Modules.space,
  submodel: Modules.segment,
  action: 'estimateReach',
  bodySchema: segmentEstimateReachBodySchema,
  responseSchema: segmentEstimateReachResponseSchema,
  middleware: [validateSubmodelPermission('create')],
  description:
    'Counts the customers of this space a candidate segment rule matches today. Nothing is saved.',
});
