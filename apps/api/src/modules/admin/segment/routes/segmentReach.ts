/**
 * @atlas
 * @kind route
 * @partOf feature:segment, superadmin
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates/action';
import { Modules } from '#/modules/modules';
import { segmentReachBodySchema, segmentReachResponseSchema } from '#/modules/segment/schemas/segmentSchemas';

export const segmentReachRoute = actionRoute({
  model: Modules.segment,
  action: 'reach',
  admin: true,
  skipId: true,
  bodySchema: segmentReachBodySchema,
  responseSchema: segmentReachResponseSchema,
  description: 'Counts the platform’s customers a candidate segment rule matches today. Nothing is saved.',
});
