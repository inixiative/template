/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactReadManyArtifactsRoute } from '#/modules/artifact/routes/artifactReadManyArtifacts';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const artifactReadManyArtifactsController = makeController(
  artifactReadManyArtifactsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const container = getResource<'artifact'>(c);
    const members = await db.artifact.findMany({
      where: { containers: { some: { containerArtifactId: container.id } } },
      orderBy: { name: 'asc' },
    });
    const verdicts = await checkArtifactAccess(
      artifactActorFromContext(c),
      members.map((member) => member.id),
      'read',
    );
    return respond.ok(members.filter((member) => verdicts.get(member.id)?.allowed));
  },
);
