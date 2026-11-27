/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadRoute } from '#/modules/artifact/routes/artifactRead';
import { readArtifactDetail } from '#/modules/artifact/services/readArtifactDetail';

export const artifactReadController = makeController(artifactReadRoute, async (c, respond) => {
  const detail = await readArtifactDetail(c, contextResource<'artifact'>(c));
  return respond.ok(detail);
});
