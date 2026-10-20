import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { AuditAction, IntegrationOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { batchRouter } from '#/modules/batch';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { createBearerToken } from '#tests/utils/createBearerToken';

registerAuditLogHook();

describe('batch: a bound credential carries its audit origin into every sub-request', () => {
  const { fetch } = createTestApp({
    mount: [
      (app) => {
        app.use('*', tokenAuthMiddleware);
        app.use('*', auditActorMiddleware);
        app.route('/api/v1/batch', batchRouter);
        app.route('/api/v1/organization', organizationRouter);
      },
    ],
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('stamps the bound integration on writes made inside the batch, with no header', async () => {
    const { entity: person, context } = await createUser();
    const { entity: organization } = await createOrganization();
    await createOrganizationUser({ role: 'owner' }, { user: person, organization });
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: person.id },
      context,
    );
    const { authorization } = await createBearerToken(person, {
      role: 'owner',
      integrationId: integration.id,
    });

    const response = await fetch(
      new Request('http://test/api/v1/batch/execute', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: [
            [
              {
                method: 'PATCH',
                path: `/api/v1/organization/${organization.id}`,
                body: { name: 'renamed in a batch' },
              },
            ],
          ],
          strategy: 'allowFailures',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { batch: { status: number }[][] } };
    expect(data.batch[0]?.[0]?.status).toBe(200);

    const log = await db.auditLog.findFirst({
      where: { subjectOrganizationId: organization.id, action: AuditAction.update },
      orderBy: { id: 'desc' },
    });
    expect(log?.integrationId).toBe(integration.id);
  });
});
