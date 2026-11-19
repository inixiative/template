import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
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
      recordModel: WebhookModel.CustomerRelationship,
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
      { recordModel: 'CustomerRelationship' },
      { integration, customerRelationship },
    );

    const poisoned = await poisonIntegrationRecord({
      integrationId: integration.id,
      recordModel: WebhookModel.CustomerRelationship,
      resourceId: customerRelationship.id,
      reason: 'HTTP 422: Unprocessable Entity',
    });

    expect(poisoned.id).toBe(existing.id);
    expect(poisoned.poisonedAt).toBeInstanceOf(Date);
    expect(poisoned.poisonedReason).toBe('HTTP 422: Unprocessable Entity');
  });
});
