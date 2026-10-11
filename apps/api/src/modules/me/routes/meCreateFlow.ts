/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, primitive:flows
 */
import { createRoute } from '#/lib/routeTemplates';
import { flowCreateBodySchema, flowResponseSchema } from '#/modules/flow/schemas/flowSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meCreateFlowRoute = createRoute({
  model: Modules.me,
  submodel: Modules.flow,
  skipId: true,
  description:
    'Starts a flow for the current user: its steps are created in order and never change after.',
  bodySchema: flowCreateBodySchema,
  responseSchema: flowResponseSchema,
  tags: [Tags.me, Tags.flow],
});
