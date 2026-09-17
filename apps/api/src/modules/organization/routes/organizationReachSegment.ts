/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:segment
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { segmentReachBodySchema, segmentReachResponseSchema } from '#/modules/segment/schemas/segmentSchemas';

export const organizationReachSegmentRoute = actionRoute({
  model: Modules.organization,
  submodel: Modules.segment,
  action: 'reach',
  bodySchema: segmentReachBodySchema,
  responseSchema: segmentReachResponseSchema,
  middleware: [validatePermission('manage')],
  description: 'Counts the customers of this organization a candidate segment rule matches today. Nothing is saved.',
});
