/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import type { Prisma } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { makeController } from '#/lib/utils/makeController';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { hydrateArtifact } from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactCreateArtifactPermissionRoute } from '#/modules/artifact/routes/artifactCreateArtifactPermission';

export const artifactCreateArtifactPermissionController = makeController(
  artifactCreateArtifactPermissionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = contextResource<'artifact'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');
    const permission = await withOwnerLock(artifactOwner(artifact), 'containers', () =>
      db.txn(async () => {
        const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: artifact.id });
        if (!locked || locked.deletedAt) {
          throw makeError({ status: 404, message: 'Artifact not found' });
        }
        const hydrated = await hydrateArtifact(locked);
        if (
          !check(
            permix,
            rebacSchema,
            'artifactPermission',
            { id: '', artifactId: locked.id, role: body.role, artifact: hydrated },
            'create',
          )
        ) {
          throw makeError({ status: 403, message: 'Forbidden' });
        }
        return db.artifactPermission.create({
          data: { ...body, artifactId: locked.id } as Prisma.ArtifactPermissionUncheckedCreateInput,
        });
      }),
    );
    return respond.created(permission);
  },
);
