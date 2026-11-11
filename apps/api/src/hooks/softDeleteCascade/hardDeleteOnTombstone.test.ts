import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { TokenOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createFlow,
  createIntegration,
  createOrganization,
  createToken,
  createUser,
  createWebhookSubscription,
} from '@template/db/test';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import {
  deleteBehaviorViolations,
  skipReviveViolations,
} from '#/hooks/softDeleteCascade/validateDeleteBehavior';

beforeEach(() => {
  registerSoftDeleteCascadeHook();
});

const tokenStamp = async (id: string) =>
  (await db.withDeleted(() => db.token.findUniqueOrThrow({ where: { id } }))).deletedAt;

const tombstoneUser = (id: string) =>
  db.user.update({ where: { id }, data: { deletedAt: new Date() } });
const tombstoneOrg = (id: string) =>
  db.organization.update({ where: { id }, data: { deletedAt: new Date() } });
const tombstoneIntegration = (id: string) =>
  db.integration.update({ where: { id }, data: { deletedAt: new Date() } });

describe('hardDeleteOnTombstone — rows that cannot outlive their parent', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('tombstones a tombstoned user’s tokens, keeping their rows (Aron, 2026-11-02)', async () => {
    const { entity: user } = await createUser();
    const { entity: token } = await createToken({ ownerModel: 'User' }, { user });

    await tombstoneUser(user.id);

    expect(await db.token.findUnique({ where: { id: token.id } })).toBeNull();
    expect(await tokenStamp(token.id)).not.toBeNull();
  });

  it('hard-deletes a tombstoned user’s webhook subscriptions', async () => {
    const { entity: user, context } = await createUser();
    const { entity: subscription } = await createWebhookSubscription(
      { model: 'CustomerRef', ownerModel: 'User' },
      context,
    );

    await tombstoneUser(user.id);

    expect(await db.webhookSubscription.findUnique({ where: { id: subscription.id } })).toBeNull();
  });

  it('hard-deletes a tombstoned user’s flows', async () => {
    const { entity: user } = await createUser();
    const { entity: flow } = await createFlow({}, { user });

    await tombstoneUser(user.id);

    expect(await db.flow.findUnique({ where: { id: flow.id } })).toBeNull();
  });

  it('tombstones an organization’s tokens when the organization is tombstoned', async () => {
    const { entity: org } = await createOrganization();
    const { entity: token } = await createToken(
      { ownerModel: TokenOwnerModel.Organization },
      { organization: org },
    );

    await tombstoneOrg(org.id);

    expect(await tokenStamp(token.id)).not.toBeNull();
  });

  it('tombstones a tombstoned integration’s tokens and hard-deletes its webhook subscriptions', async () => {
    const { entity: user, context } = await createUser();
    const { entity: integration } = await createIntegration({
      ownerModel: 'User',
      userId: user.id,
    });
    const { entity: token } = await createToken({ ownerModel: 'Integration' }, { integration });
    const { entity: subscription } = await createWebhookSubscription(
      { model: 'CustomerRef', ownerModel: 'User', integrationId: integration.id },
      context,
    );

    await tombstoneIntegration(integration.id);

    expect(await tokenStamp(token.id)).not.toBeNull();
    expect(await db.webhookSubscription.findUnique({ where: { id: subscription.id } })).toBeNull();
  });
});

describe('validateDeleteBehavior', () => {
  it('finds the registry consistent with the schema', () => {
    expect(deleteBehaviorViolations()).toEqual([]);
  });

  it('catches a required child left behind by a hard delete', () => {
    expect(deleteBehaviorViolations(['WebhookSubscription']).join('\n')).toContain(
      'WebhookEvent.webhookSubscriptionId is a required reference to WebhookSubscription',
    );
  });

  it('refuses a model that carries deletedAt', () => {
    expect(deleteBehaviorViolations(['Account']).join('\n')).toContain('has a deletedAt column');
  });

  it('refuses a model that is also registered as soft-delete', () => {
    expect(deleteBehaviorViolations(['User']).join('\n')).toContain(
      'both hard-delete-on-tombstone and soft-delete',
    );
  });

  it('refuses a model that is not in the schema', () => {
    expect(deleteBehaviorViolations(['NotAModel']).join('\n')).toContain(
      'is not a model in the schema',
    );
  });
});

describe('SKIP_REVIVE validation', () => {
  it('finds the registry consistent with the schema', () => {
    expect(skipReviveViolations()).toEqual([]);
  });

  it('accepts a soft-deleted model', () => {
    expect(skipReviveViolations(['Tag'])).toEqual([]);
  });

  it('refuses a model that is hard-deleted on tombstone', () => {
    expect(skipReviveViolations(['Session']).join('\n')).toContain(
      'both SKIP_REVIVE and HARD_DELETE_ON_TOMBSTONE',
    );
  });

  it('refuses a model with no deletedAt column', () => {
    expect(skipReviveViolations(['AuditLog']).join('\n')).toContain('has no deletedAt column');
  });

  it('refuses a model that is not in the schema', () => {
    expect(skipReviveViolations(['NotAModel']).join('\n')).toContain(
      'is not a model in the schema',
    );
  });
});
