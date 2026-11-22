/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadRoute } from '#/modules/artifact/routes/artifactRead';

export const artifactReadController = makeController(artifactReadRoute, async (c, respond) =>
  respond.ok(contextResource<'artifact'>(c)),
);
