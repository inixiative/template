/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:routeTemplates, primitive:authz
 */
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { type IdentifyResponse, identifyReadRoute } from '#/modules/identify/routes/identifyRead';

export const identifyReadController = makeController(identifyReadRoute, async (c, respond) => {
  const actor = c.get('permix').getActor();
  if (!actor) throw makeError({ status: 401, message: 'Authentication required' });
  return respond.ok(actor as IdentifyResponse);
});
