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

export const organizationReachSegmentRoute = actionRoute({
  model: Modules.organization,
  submodel: Modules.segment,
  action: 'reach',
  bodySchema: segmentReachBodySchema,
  responseSchema: segmentReachResponseSchema,
  middleware: [validateSubmodelPermission('create')],
  description:
    'Counts the customers of this organization a candidate segment rule matches today. Nothing is saved.',
});
