/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadUsesRoute } from '#/modules/artifact/routes/artifactReadUses';
import { listArtifactUses } from '#/modules/artifact/services/listArtifactUses';

export const artifactReadUsesController = makeController(
  artifactReadUsesRoute,
  async (c, respond) => respond.ok(await listArtifactUses(c, getResource<'artifact'>(c).id)),
);
