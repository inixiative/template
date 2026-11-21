import { afterEach, describe, expect, it } from 'bun:test';
import { db, revive } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { EntitlementResourceModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createIntegrationResource,
  createProject,
  createProjectIntegrationResource,
  createRuleReference,
  createSegment,
  createToken,
  createUser,
} from '@template/db/test';

const resourceStamp = async (id: string) =>
  (await db.withDeleted(() => db.integrationResource.findUniqueOrThrow({ where: { id } })))
    .deletedAt;

const linkStamp = async (id: string) =>
  (await db.withDeleted(() => db.projectIntegrationResource.findUniqueOrThrow({ where: { id } })))
    .deletedAt;

const createIntegrationWithLinkedResource = async () => {
  const { entity: user, context } = await createUser();
  const { entity: integration } = await createIntegration(
    { ownerModel: 'User', userId: user.id },
    context,
  );
  const { entity: resource } = await createIntegrationResource({}, { integration });
  const { entity: project } = await createProject({ ownerModel: 'User' }, { user });
  const { entity: link } = await createProjectIntegrationResource(
    {},
    { project, integrationResource: resource },
  );
  return { user, integration, resource, project, link };
};

const anchoredTokenEntitlement = async (user: User, resource: { id: string }): Promise<string> => {
  const { entity: token } = await createToken(
    {
      ownerModel: 'User',
      role: 'viewer',
      entitlements: [
        {
          resource: EntitlementResourceModel.IntegrationResource,
          actions: ['read'],
          sourceModel: EntitlementResourceModel.IntegrationResource,
          sourceId: resource.id,
        },
      ],
    },
    { user },
  );
  return token.id;
};

const sourceDeletedAtOf = async (tokenId: string) =>
  (await db.entitlement.findFirstOrThrow({ where: { targetModel: 'Token', targetId: tokenId } }))
    .sourceDeletedAt;

describe('an integration resource dies and revives with its integration (Aron, 2026-11-19)', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('tombstones its resources and their project links with the integration’s stamp', async () => {
    const { integration, resource, link } = await createIntegrationWithLinkedResource();

    const { deletedAt } = await db.integration.update({
      where: { id: integration.id },
      data: { deletedAt: new Date() },
    });

    expect(await resourceStamp(resource.id)).toEqual(deletedAt);
    expect(await linkStamp(link.id)).toEqual(deletedAt);
    expect(await db.integrationResource.findMany({ where: { id: resource.id } })).toEqual([]);
  });

  it('degrades an entitlement anchored at the resource instead of revoking it, and heals it on revive', async () => {
    const { user, integration, resource } = await createIntegrationWithLinkedResource();
    const tokenId = await anchoredTokenEntitlement(user, resource);

    const { deletedAt } = await db.integration.update({
      where: { id: integration.id },
      data: { deletedAt: new Date() },
    });
    expect(await sourceDeletedAtOf(tokenId)).toEqual(deletedAt);

    await revive(db.integration, { id: integration.id });
    expect(await sourceDeletedAtOf(tokenId)).toBeNull();
  });

  it('revives the resources and links that died with it, and no others', async () => {
    const { integration, resource, link } = await createIntegrationWithLinkedResource();
    const { entity: removedEarlier } = await createIntegrationResource({}, { integration });
    const removedAt = new Date(Date.now() - 60_000);
    await db.integrationResource.update({
      where: { id: removedEarlier.id },
      data: { deletedAt: removedAt },
    });

    await db.integration.update({ where: { id: integration.id }, data: { deletedAt: new Date() } });
    await revive(db.integration, { id: integration.id });

    expect(await resourceStamp(resource.id)).toBeNull();
    expect(await linkStamp(link.id)).toBeNull();
    expect(await resourceStamp(removedEarlier.id)).toEqual(removedAt);
  });

  it('a project’s delete tombstones its links and leaves the resource live', async () => {
    const { resource, project, link } = await createIntegrationWithLinkedResource();

    const { deletedAt } = await db.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date() },
    });

    expect(await linkStamp(link.id)).toEqual(deletedAt);
    expect(await resourceStamp(resource.id)).toBeNull();
  });

  it('stamps a rule reference naming the resource', async () => {
    const { user, integration, resource } = await createIntegrationWithLinkedResource();
    const { entity: segment } = await createSegment({ ownerModel: 'User' }, { user });
    const { entity: edge } = await createRuleReference({
      sourceModel: 'Segment',
      sourceSegmentId: segment.id,
      targetModel: 'IntegrationResource',
      targetIntegrationResourceId: resource.id,
    });

    const { deletedAt } = await db.integration.update({
      where: { id: integration.id },
      data: { deletedAt: new Date() },
    });

    expect(
      (await db.ruleReference.findUniqueOrThrow({ where: { id: edge.id } })).targetDeletedAt,
    ).toEqual(deletedAt);
  });

  it('a removed resource can be registered again under the same kind and externalId', async () => {
    const { integration, resource } = await createIntegrationWithLinkedResource();
    await db.integrationResource.update({
      where: { id: resource.id },
      data: { deletedAt: new Date() },
    });

    const { entity: again } = await createIntegrationResource(
      { kind: resource.kind, externalId: resource.externalId },
      { integration },
    );

    expect(again.id).not.toBe(resource.id);
    expect(await resourceStamp(again.id)).toBeNull();
  });

  it('refuses a hard delete of a resource', async () => {
    const { resource } = await createIntegrationWithLinkedResource();
    await expect(db.integrationResource.delete({ where: { id: resource.id } })).rejects.toThrow(
      'is soft-delete',
    );
  });
});
