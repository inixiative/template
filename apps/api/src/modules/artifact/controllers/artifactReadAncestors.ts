/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadAncestorsRoute } from '#/modules/artifact/routes/artifactReadAncestors';
import { fetchArtifactAncestors } from '#/modules/artifact/services/fetchArtifactAncestors';

export const artifactReadAncestorsController = makeController(
  artifactReadAncestorsRoute,
  async (c, respond) => {
    const ancestry = await fetchArtifactAncestors(
      c.get('permix'),
      contextResource<'artifact'>(c).id,
    );
    return respond.ok(ancestry);
  },
);
