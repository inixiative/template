import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { IntegrationOwnerModel } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createIntegration, createOrganization, createUser } from '@template/db/test';
import { findOwnedIntegration } from '#/modules/integration/services/findOwnedIntegration';

describe('findOwnedIntegration', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('resolves an integration owned by an org in scope', async () => {
    const { entity: org } = await createOrganization();
    const { entity: integration } = await createIntegration({
      ownerModel: IntegrationOwnerModel.Organization,
      organizationId: org.id,
      name: 'Salesforce',
    });

    const found = await findOwnedIntegration(integration.id, { organizationIds: [org.id] });
    expect(found?.id).toBe(integration.id);
  });

  it('fails closed: an integration owned by an org outside the scope resolves to null', async () => {
    const { entity: orgInScope } = await createOrganization();
    const { entity: orgOutOfScope } = await createOrganization();
    const { entity: foreign } = await createIntegration({
      ownerModel: IntegrationOwnerModel.Organization,
      organizationId: orgOutOfScope.id,
      name: 'Foreign',
    });

    const found = await findOwnedIntegration(foreign.id, { organizationIds: [orgInScope.id] });
    expect(found).toBeNull();
  });

  it('resolves a user-owned integration by userId scope', async () => {
    const { entity: user } = await createUser();
    const { entity: integration } = await createIntegration({
      ownerModel: IntegrationOwnerModel.User,
      userId: user.id,
      name: 'Personal',
    });

    const found = await findOwnedIntegration(integration.id, { userId: user.id });
    expect(found?.id).toBe(integration.id);
  });

  it('ignores a soft-deleted integration even when the caller owns it', async () => {
    const { entity: org } = await createOrganization();
    const { entity: integration } = await createIntegration({
      ownerModel: IntegrationOwnerModel.Organization,
      organizationId: org.id,
      name: 'Retired',
      deletedAt: new Date(),
    });

    const found = await findOwnedIntegration(integration.id, { organizationIds: [org.id] });
    expect(found).toBeNull();
  });

  it('resolves to null when the scope carries no owners', async () => {
    const { entity: org } = await createOrganization();
    const { entity: integration } = await createIntegration({
      ownerModel: IntegrationOwnerModel.Organization,
      organizationId: org.id,
      name: 'Orphanable',
    });

    const found = await findOwnedIntegration(integration.id, {});
    expect(found).toBeNull();
  });
});
