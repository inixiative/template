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
  segmentReachBodySchema,
  segmentReachResponseSchema,
} from '#/modules/segment/schemas/segmentSchemas';

export const spaceEstimateReachSegmentRoute = actionRoute({
  model: Modules.space,
  submodel: Modules.segment,
  action: 'estimateReach',
  bodySchema: segmentReachBodySchema,
  responseSchema: segmentReachResponseSchema,
  middleware: [validateSubmodelPermission('create')],
  description:
    'Counts the customers of this space a candidate segment rule matches today. Nothing is saved.',
});
