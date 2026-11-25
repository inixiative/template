import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Provider } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createProject,
  createProjectIntegration,
} from '@template/db/test';
import { INTEGRATION_ONE_PER } from '@template/shared/integrations/integrationOnePer';

const onePerProvider: Provider = 'linear';
const otherProvider: Provider = 'slack';

beforeEach(() => {
  INTEGRATION_ONE_PER[onePerProvider] = ['owner', 'project'];
});

afterEach(async () => {
  delete INTEGRATION_ONE_PER[onePerProvider];
  await cleanupTouchedTables(db);
});

const orgIntegration = (organizationId: string, provider: Provider) =>
  createIntegration({ ownerModel: 'Organization', organizationId, provider });

describe('integrationOnePer hook', () => {
  it('allows one live integration of an one-per-owner provider per owner', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: other } = await createOrganization();
    const { entity: first } = await orgIntegration(organization.id, onePerProvider);

    await expect(orgIntegration(organization.id, onePerProvider)).rejects.toMatchObject({
      status: 409,
    });
    await orgIntegration(other.id, onePerProvider);
    await orgIntegration(organization.id, otherProvider);
    await orgIntegration(organization.id, otherProvider);

    await db.integration.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    await orgIntegration(organization.id, onePerProvider);
  });

  it('allows one live link per project to an integration of a one-per-project provider', async () => {
    INTEGRATION_ONE_PER[onePerProvider] = ['project'];
    const { entity: organization } = await createOrganization();
    const { entity: project } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: first } = await orgIntegration(organization.id, onePerProvider);
    const { entity: second } = await orgIntegration(organization.id, onePerProvider);
    const { entity: firstLink } = await createProjectIntegration(
      {},
      { project, integration: first },
    );

    await expect(
      createProjectIntegration({}, { project, integration: second }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      db.withDeleted(() =>
        db.projectIntegration.upsert({
          where: {
            projectId_integrationId: { projectId: project.id, integrationId: second.id },
          },
          create: { projectId: project.id, integrationId: second.id },
          update: { deletedAt: null },
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    const { entity: plain } = await orgIntegration(organization.id, otherProvider);
    const { entity: plainToo } = await orgIntegration(organization.id, otherProvider);
    await createProjectIntegration({}, { project, integration: plain });
    await createProjectIntegration({}, { project, integration: plainToo });

    await db.projectIntegration.update({
      where: { id: firstLink.id },
      data: { deletedAt: new Date() },
    });
    const { entity: secondLink } = await createProjectIntegration(
      {},
      { project, integration: second },
    );

    await expect(
      db.withDeleted(() =>
        db.projectIntegration.update({ where: { id: firstLink.id }, data: { deletedAt: null } }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(secondLink.integrationId).toBe(second.id);
  });

  it('refuses a provider change, an integration restore and a connect-form link that would break a one-per rule', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: project } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: slack } = await orgIntegration(organization.id, otherProvider);
    const { entity: first } = await orgIntegration(organization.id, onePerProvider);

    await expect(
      db.integration.update({ where: { id: slack.id }, data: { provider: onePerProvider } }),
    ).rejects.toMatchObject({ status: 422 });

    await createProjectIntegration({}, { project, integration: first });
    await db.integration.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    const { entity: second } = await orgIntegration(organization.id, onePerProvider);
    await expect(
      db.withDeleted(() =>
        db.integration.update({ where: { id: first.id }, data: { deletedAt: null } }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    INTEGRATION_ONE_PER[onePerProvider] = ['project'];
    const { entity: third } = await orgIntegration(organization.id, onePerProvider);
    await createProjectIntegration({}, { project, integration: second });
    await expect(
      db.projectIntegration.upsert({
        where: {
          projectId_integrationId: { projectId: project.id, integrationId: third.id },
        },
        create: {
          project: { connect: { id: project.id } },
          integration: { connect: { id: third.id } },
        },
        update: {},
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('an upsert refreshes the live one-per-owner integration itself, and reviving a removed one beside a live one is refused', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: removed } = await orgIntegration(organization.id, onePerProvider);
    await db.integration.update({ where: { id: removed.id }, data: { deletedAt: new Date() } });
    const { entity: live } = await orgIntegration(organization.id, onePerProvider);
    const create = {
      ownerModel: 'Organization',
      organizationId: organization.id,
      provider: onePerProvider,
      name: 'Linear',
    } as const;

    await db.integration.upsert({ where: { id: live.id }, create, update: { name: 'renamed' } });
    await expect(
      db.withDeleted(() =>
        db.integration.upsert({ where: { id: removed.id }, create, update: { deletedAt: null } }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
