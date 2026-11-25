import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Integration, Organization } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createProject,
  createProjectIntegration,
  createSetting,
} from '@template/db/test';
import { SETTING_DEFINITIONS } from '@template/shared/settings';
import { defineSetting } from '@template/shared/settings/types';
import { z } from 'zod';

const scoped = defineSetting({
  key: 'test.scopedToLinear',
  category: 'general',
  label: 'Scoped',
  description: 'Applies only to Linear integrations and their project links.',
  resourceModels: ['Integration', 'ProjectIntegration'],
  integrationProviders: ['linear'],
  valueType: 'boolean',
  schema: z.boolean(),
  defaultValue: false,
  order: 99,
  permission: 'manage',
});
const definitions = SETTING_DEFINITIONS as Record<string, unknown>;
const value = { key: scoped.key, valueText: null, valueBoolean: true };

let organization: Organization;
const integrationOf = (provider: 'linear' | 'slack') =>
  createIntegration({ ownerModel: 'Organization', organizationId: organization.id, provider }).then(
    ({ entity }) => entity as Integration,
  );

beforeEach(async () => {
  definitions[scoped.key] = scoped;
  ({ entity: organization } = await createOrganization());
});

afterEach(async () => {
  delete definitions[scoped.key];
  await cleanupTouchedTables(db);
});

describe('a setting scoped to a provider is written only on that provider', () => {
  it('on an integration', async () => {
    await createSetting(
      { ...value, resourceModel: 'Integration' },
      { integration: await integrationOf('linear') },
    );
    await expect(
      createSetting(
        { ...value, resourceModel: 'Integration' },
        { integration: await integrationOf('slack') },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('on a project link, by the integration it links to', async () => {
    const { entity: project } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: linearLink } = await createProjectIntegration(
      {},
      { project, integration: await integrationOf('linear') },
    );
    const { entity: slackLink } = await createProjectIntegration(
      {},
      { project, integration: await integrationOf('slack') },
    );
    await createSetting(
      { ...value, resourceModel: 'ProjectIntegration' },
      { projectIntegration: linearLink },
    );
    await expect(
      createSetting(
        { ...value, resourceModel: 'ProjectIntegration' },
        { projectIntegration: slackLink },
      ),
    ).rejects.toMatchObject({
      status: 422,
    });
  });
});
