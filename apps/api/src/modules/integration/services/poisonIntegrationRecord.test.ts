import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { IntegrationOwnerModel, WebhookModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createIntegration,
  createIntegrationRecord,
  createUser,
} from '@template/db/test';
import { poisonIntegrationRecord } from '#/modules/integration/services/poisonIntegrationRecord';

describe('poisonIntegrationRecord', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const setup = async () => {
    const { entity: provider } = await createUser();
    const { entity: customer } = await createUser();
    const { entity: customerRef } = await createCustomerRef({
      customerModel: 'User',
      providerModel: 'User',
      customerUser: customer,
      providerUser: provider,
    });
    const { entity: integration } = await createIntegration({
      ownerModel: IntegrationOwnerModel.User,
      userId: provider.id,
    });
    return { customerRef, integration };
  };

  it('keeps the first poison when the record is poisoned again', async () => {
    const { customerRef, integration } = await setup();
    const input = { integrationId: integration.id, model: WebhookModel.CustomerRef, resourceId: customerRef.id };

    const first = await poisonIntegrationRecord({ ...input, reason: 'HTTP 400: first' });
    const second = await poisonIntegrationRecord({ ...input, reason: 'HTTP 422: second' });

    expect(second.id).toBe(first.id);
    expect(second.poisonedReason).toBe('HTTP 400: first');
  });

  it('stamps an existing record that is not poisoned yet', async () => {
    const { customerRef, integration } = await setup();
    const { entity: existing } = await createIntegrationRecord({ integration, customerRef });

    const poisoned = await poisonIntegrationRecord({
      integrationId: integration.id,
      model: WebhookModel.CustomerRef,
      resourceId: customerRef.id,
      reason: 'HTTP 422: Unprocessable Entity',
    });

    expect(poisoned.id).toBe(existing.id);
    expect(poisoned.poisonedAt).toBeInstanceOf(Date);
    expect(poisoned.poisonedReason).toBe('HTTP 422: Unprocessable Entity');
  });
});
