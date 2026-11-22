/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { flowDeleteRoute } from '#/modules/flow/routes/flowDelete';

export const flowDeleteController = makeController(flowDeleteRoute, async (c, respond) => {
  await c.get('db').flow.delete({ where: { id: contextResource<'flow'>(c).id } });
  return respond.noContent();
});
