/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { contextArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { organizationUserCreateArtifactRoute } from '#/modules/organizationUser/routes/organizationUserCreateArtifact';

export const organizationUserCreateArtifactController = makeController(
  organizationUserCreateArtifactRoute,
  async (c, respond) =>
    respond.created(
      await createArtifact(c.get('permix'), {
        ...c.req.valid('json'),
        ...contextArtifactOwner(c),
      }),
    ),
);
