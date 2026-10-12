/**
 * @atlas
 * @kind controller
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { flowDeleteRoute } from '#/modules/flow/routes/flowDelete';

export const flowDeleteController = makeController(flowDeleteRoute, async (c, respond) => {
  await c.get('db').flow.deleteMany({ where: { id: getResource<'flow'>(c).id } });
  return respond.noContent();
});
