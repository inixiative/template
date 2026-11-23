/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadUsesRoute } from '#/modules/artifact/routes/artifactReadUses';
import { fetchArtifactUses } from '#/modules/artifact/services/fetchArtifactUses';

export const artifactReadUsesController = makeController(
  artifactReadUsesRoute,
  async (c, respond) => respond.ok(await fetchArtifactUses(c, contextResource<'artifact'>(c).id)),
);
