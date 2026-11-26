/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { contextArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { meCreateArtifactRoute } from '#/modules/me/routes/meCreateArtifact';

export const meCreateArtifactController = makeController(
  meCreateArtifactRoute,
  async (c, respond) =>
    respond.created(
      await createArtifact(c.get('permix'), {
        ...c.req.valid('json'),
        ...contextArtifactOwner(c),
      }),
    ),
);
