import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createProject,
  createProjectIntegration,
} from '@template/db/test';
import { INTEGRATION_SINGLETONS } from '@template/shared/integrations/integrationSingletons';

const singletonProvider = 'linear';
const otherProvider = 'slack';

beforeEach(() => {
  INTEGRATION_SINGLETONS[singletonProvider] = ['owner', 'project'];
});

afterEach(async () => {
  delete INTEGRATION_SINGLETONS[singletonProvider];
  await cleanupTouchedTables(db);
});

const orgIntegration = (organizationId: string, provider: string) =>
  createIntegration({ ownerModel: 'Organization', organizationId, provider } as never);

describe('integrationSingleton hook', () => {
  it('allows one live integration of an owner-singleton provider per owner', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: other } = await createOrganization();
    const { entity: first } = await orgIntegration(organization.id, singletonProvider);

    await expect(orgIntegration(organization.id, singletonProvider)).rejects.toMatchObject({
      status: 409,
    });
    await orgIntegration(other.id, singletonProvider);
    await orgIntegration(organization.id, otherProvider);
    await orgIntegration(organization.id, otherProvider);

    await db.integration.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    await orgIntegration(organization.id, singletonProvider);
  });

  it('allows one live link per project to an integration of a project-singleton provider', async () => {
    INTEGRATION_SINGLETONS[singletonProvider] = ['project'];
    const { entity: organization } = await createOrganization();
    const { entity: project } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: first } = await orgIntegration(organization.id, singletonProvider);
    const { entity: second } = await orgIntegration(organization.id, singletonProvider);
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
});
