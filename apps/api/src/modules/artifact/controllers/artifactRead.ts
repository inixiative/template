/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadRoute } from '#/modules/artifact/routes/artifactRead';

export const artifactReadController = makeController(artifactReadRoute, async (c, respond) =>
  respond.ok(getResource<'artifact'>(c)),
);
