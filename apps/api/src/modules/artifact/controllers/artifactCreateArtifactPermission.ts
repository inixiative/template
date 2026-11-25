/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import type { Prisma } from '@template/db';
import { check } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { artifactCreateArtifactPermissionRoute } from '#/modules/artifact/routes/artifactCreateArtifactPermission';
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { hydrateArtifact } from '#/modules/artifact/services/checkArtifactPermission';

export const artifactCreateArtifactPermissionController = makeController(
  artifactCreateArtifactPermissionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = contextResource<'artifact'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');
    const permission = await withLockedArtifacts([artifact], async (locked) => {
      const target = locked.get(artifact.id)!;
      const hydrated = await hydrateArtifact(target);
      if (
        !check(
          permix,
          'artifactPermission',
          { id: '', artifactId: target.id, role: body.role, artifact: hydrated },
          'create',
        )
      ) {
        throw makeError({ status: 403, message: 'Forbidden' });
      }
      return db.artifactPermission.create({
        data: { ...body, artifactId: target.id } as Prisma.ArtifactPermissionUncheckedCreateInput,
      });
    });
    return respond.created(permission);
  },
);
