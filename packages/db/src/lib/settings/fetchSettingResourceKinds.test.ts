import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db/client';
import { fetchSettingResourceKinds } from '@template/db/lib/settings/fetchSettingResourceKinds';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createProject,
  createProjectIntegration,
} from '@template/db/test';

describe('fetchSettingResourceKinds', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it("reads an integration's provider and its family", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: drive } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      provider: 'drive',
    });
    expect(
      await fetchSettingResourceKinds({
        resourceModel: 'Integration',
        resourceIntegrationId: drive.id,
      }),
    ).toEqual({ provider: 'drive', integrationFamily: 'google' });
  });

  it('gives a provider with no family a null family, as it does a custom integration', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: linear } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      provider: 'linear',
    });
    const { entity: custom } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      provider: null,
    });
    expect(
      await fetchSettingResourceKinds({
        resourceModel: 'Integration',
        resourceIntegrationId: linear.id,
      }),
    ).toEqual({ provider: 'linear', integrationFamily: null });
    expect(
      await fetchSettingResourceKinds({
        resourceModel: 'Integration',
        resourceIntegrationId: custom.id,
      }),
    ).toEqual({ provider: null, integrationFamily: null });
  });

  it("reads a project link's kinds from the integration it links to", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: project } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: drive } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      provider: 'drive',
    });
    const { entity: link } = await createProjectIntegration({}, { project, integration: drive });
    expect(
      await fetchSettingResourceKinds({
        resourceModel: 'ProjectIntegration',
        resourceProjectIntegrationId: link.id,
      }),
    ).toEqual({ provider: 'drive', integrationFamily: 'google' });
  });

  it('gives no kinds to models without kind fields', async () => {
    expect(await fetchSettingResourceKinds({ resourceModel: 'User' })).toEqual({});
  });
});
