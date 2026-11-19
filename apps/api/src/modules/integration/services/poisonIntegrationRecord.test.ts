import { afterEach, describe, expect, it } from 'bun:test';
import { db, revive } from '@template/db';
import { IntegrationOwnerModel, WebhookModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCustomerRelationship,
  createIntegration,
  createIntegrationRecord,
  createUser,
} from '@template/db/test';
import { poisonIntegrationRecord } from '#/modules/integration/services/poisonIntegrationRecord';

describe('poisonIntegrationRecord', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  const setup = async () => {
    const { entity: provider } = await createUser();
    const { entity: customer } = await createUser();
    const { entity: customerRelationship } = await createCustomerRelationship({
      customerModel: 'User',
      providerModel: 'User',
      customerUserId: customer.id,
      providerUserId: provider.id,
    });
    const { entity: integration } = await createIntegration({
      ownerModel: IntegrationOwnerModel.User,
      userId: provider.id,
    });
    return { customerRelationship, integration };
  };

  it('keeps the first poison when the record is poisoned again', async () => {
    const { customerRelationship, integration } = await setup();
    const input = {
      integrationId: integration.id,
      model: WebhookModel.CustomerRelationship,
      resourceId: customerRelationship.id,
    };

    const first = await poisonIntegrationRecord({ ...input, reason: 'HTTP 400: first' });
    const second = await poisonIntegrationRecord({ ...input, reason: 'HTTP 422: second' });

    expect(second.id).toBe(first.id);
    expect(second.poisonedReason).toBe('HTTP 400: first');
  });

  it('stamps an existing record that is not poisoned yet', async () => {
    const { customerRelationship, integration } = await setup();
    const { entity: existing } = await createIntegrationRecord(
      { model: 'CustomerRelationship' },
      { integration, customerRelationship },
    );

    const poisoned = await poisonIntegrationRecord({
      integrationId: integration.id,
      model: WebhookModel.CustomerRelationship,
      resourceId: customerRelationship.id,
      reason: 'HTTP 422: Unprocessable Entity',
    });

    expect(poisoned.id).toBe(existing.id);
    expect(poisoned.poisonedAt).toBeInstanceOf(Date);
    expect(poisoned.poisonedReason).toBe('HTTP 422: Unprocessable Entity');
  });

  it('a record tombstoned with its integration revives with it, poisoned as it was', async () => {
    const { customerRelationship, integration } = await setup();
    const poisoned = await poisonIntegrationRecord({
      integrationId: integration.id,
      model: WebhookModel.CustomerRelationship,
      resourceId: customerRelationship.id,
      reason: 'HTTP 400: Bad Request',
    });

    const { deletedAt } = await db.integration.update({
      where: { id: integration.id },
      data: { deletedAt: new Date() },
    });
    expect(
      (
        await db.withDeleted(() =>
          db.integrationRecord.findUniqueOrThrow({ where: { id: poisoned.id } }),
        )
      ).deletedAt,
    ).toEqual(deletedAt);

    await revive(db.integration, { id: integration.id });
    expect(await db.integrationRecord.findUnique({ where: { id: poisoned.id } })).toMatchObject({
      deletedAt: null,
      poisonedReason: 'HTTP 400: Bad Request',
    });
  });

  it('poisons a new record when the one before it was removed', async () => {
    const { customerRelationship, integration } = await setup();
    const input = {
      integrationId: integration.id,
      model: WebhookModel.CustomerRelationship,
      resourceId: customerRelationship.id,
    };
    const first = await poisonIntegrationRecord({ ...input, reason: 'HTTP 400: first' });
    await db.integrationRecord.update({ where: { id: first.id }, data: { deletedAt: new Date() } });

    const second = await poisonIntegrationRecord({ ...input, reason: 'HTTP 422: second' });

    expect(second.id).not.toBe(first.id);
    expect(second.poisonedReason).toBe('HTTP 422: second');
  });
});
