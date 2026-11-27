/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { check } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { artifactPermissionUpdateRoute } from '#/modules/artifactPermission/routes/artifactPermissionUpdate';
import { withLockedArtifactPermission } from '#/modules/artifactPermission/services/withLockedArtifactPermission';

export const artifactPermissionUpdateController = makeController(
  artifactPermissionUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permission = contextResource<'artifactPermission'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');
    const updated = await withLockedArtifactPermission(permission, async (current, hydrated) => {
      const canWrite = (role: typeof current.role) =>
        check(permix, 'artifactPermission', { ...current, role, artifact: hydrated }, 'manage');
      if (!canWrite(current.role) || (body.role && !canWrite(body.role))) {
        throw makeError({ status: 403, message: 'Forbidden' });
      }
      // why: moving fromVersion forward (revoking older versions) triggers preserveOnRevoke / copy-on-revoke in FEAT-030 once FileVersion writes exist.
      return db.artifactPermission.update({ where: { id: current.id }, data: body });
    });
    return respond.ok(updated);
  },
);
