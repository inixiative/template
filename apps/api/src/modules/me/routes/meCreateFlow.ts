/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, primitive:flows
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { flowCreateBodySchema, flowResponseSchema } from '#/modules/flow/schemas/flowSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meCreateFlowRoute = createRoute({
  model: Modules.me,
  middleware: [validateSelfPermission('operate')],
  submodel: Modules.flow,
  skipId: true,
  description:
    "Starts a registered flow for the current user. bindings are validated against the flow's bindings schema and the steps are resolved and checked at once.",
  bodySchema: flowCreateBodySchema,
  responseSchema: flowResponseSchema,
  tags: [Tags.me, Tags.flow],
});
