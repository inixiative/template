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
import { SETTING_TREES } from '@template/shared/settings';
import { z } from 'zod';

const linearBranch = {
  linear: {
    paused: {
      valueType: 'boolean',
      schema: z.boolean(),
      defaultValue: false,
      label: 'Paused',
      description: 'Applies only to Linear integrations and their project links.',
    },
  },
} as const;

const mutableTrees = SETTING_TREES as unknown as Record<string, Record<string, unknown>>;
const value = { key: 'linear.paused', valueText: null, valueBoolean: true };

let organization: Organization;
const integrationOf = (provider: 'linear' | 'slack') =>
  createIntegration({ ownerModel: 'Organization', organizationId: organization.id, provider }).then(
    ({ entity }) => entity as Integration,
  );

beforeEach(async () => {
  mutableTrees.Integration!['provider:linear'] = linearBranch;
  mutableTrees.ProjectIntegration!['provider:linear'] = linearBranch;
  ({ entity: organization } = await createOrganization());
});

afterEach(async () => {
  delete mutableTrees.Integration!['provider:linear'];
  delete mutableTrees.ProjectIntegration!['provider:linear'];
  await cleanupTouchedTables(db);
});

describe('a setting under a provider: branch is written only on that provider', () => {
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
    ).rejects.toThrow(/'linear.paused' is not defined on this/);
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
    ).rejects.toThrow(/'linear.paused' is not defined on this/);
  });
});
