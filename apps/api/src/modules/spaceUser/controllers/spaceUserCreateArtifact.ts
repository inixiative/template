/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { contextArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { spaceUserCreateArtifactRoute } from '#/modules/spaceUser/routes/spaceUserCreateArtifact';

export const spaceUserCreateArtifactController = makeController(
  spaceUserCreateArtifactRoute,
  async (c, respond) =>
    respond.created(
      await createArtifact(c.get('permix'), {
        ...c.req.valid('json'),
        ...contextArtifactOwner(c),
      }),
    ),
);
