import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { TokenOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createToken,
  createUser,
  createWebhookSubscription,
} from '@template/db/test';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';

registerSoftDeleteCascadeHook();

const tombstoneUser = (id: string) => db.user.update({ where: { id }, data: { deletedAt: new Date() } });
const tombstoneOrg = (id: string) => db.organization.update({ where: { id }, data: { deletedAt: new Date() } });

describe('hardDeleteOnTombstone — column-less ephemeral grants', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('hard-deletes a tombstoned user’s tokens', async () => {
    const { entity: user } = await createUser();
    const { entity: token } = await createToken({}, { user });

    await tombstoneUser(user.id);

    expect(await db.token.findUnique({ where: { id: token.id } })).toBeNull();
  });

  it('hard-deletes a tombstoned user’s webhook subscriptions', async () => {
    const { entity: user, context } = await createUser();
    const { entity: subscription } = await createWebhookSubscription({}, context);

    await tombstoneUser(user.id);

    expect(await db.webhookSubscription.findUnique({ where: { id: subscription.id } })).toBeNull();
  });

  it('hard-deletes an organization’s tokens when the organization is tombstoned', async () => {
    const { entity: org } = await createOrganization();
    const { entity: token } = await createToken({ ownerModel: TokenOwnerModel.Organization }, { organization: org });

    await tombstoneOrg(org.id);

    expect(await db.token.findUnique({ where: { id: token.id } })).toBeNull();
  });
});
