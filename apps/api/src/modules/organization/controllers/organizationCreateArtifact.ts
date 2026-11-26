/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { contextArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { organizationCreateArtifactRoute } from '#/modules/organization/routes/organizationCreateArtifact';

export const organizationCreateArtifactController = makeController(
  organizationCreateArtifactRoute,
  async (c, respond) =>
    respond.created(
      await createArtifact(c.get('permix'), {
        ...c.req.valid('json'),
        ...contextArtifactOwner(c),
      }),
    ),
);
