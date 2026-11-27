import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, revive } from '@template/db';
import type {
  Integration,
  IntegrationResource,
  Organization,
  Project,
  Space,
  User,
} from '@template/db/generated/client/client';
import {
  IntegrationResourceStatus,
  OperateAccess,
  ReadAccess,
  Role,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createIntegrationResource,
  createOrganization,
  createOrganizationUser,
  createProject,
  createProjectIntegration,
  createProjectIntegrationResource,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { app } from '#/app';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createUserJwt } from '#tests/utils/createUserJwt';
import { entitlementInputFor } from '#tests/utils/entitlementInputFor';

type Headers = Record<string, string>;

const jwt = async (user: User): Promise<Headers> => ({
  authorization: (await createUserJwt(user)).authorization,
});

const request = (method: string, path: string, headers: Headers, body?: unknown) =>
  app.request(`/api/v1${path}`, {
    method,
    headers: {
      ...headers,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

describe('Integration project setup (POST/GET /integration/:id/projectIntegrations & ProjectIntegrationResource.isIdentity)', () => {
  let organization: Organization;
  let otherOrganization: Organization;
  let space: Space;
  let organizationOwner: User;
  let organizationAdmin: User;
  let organizationMember: User;
  let organizationViewer: User;
  let outsider: User;
  let organizationIntegration: Integration;
  let otherIntegration: Integration;
  let repoA: IntegrationResource;
  let repoB: IntegrationResource;
  let untrackedRepo: IntegrationResource;
  let otherRepo: IntegrationResource;
  let ownerHeaders: Headers;
  let adminHeaders: Headers;
  let memberHeaders: Headers;
  let viewerHeaders: Headers;
  let outsiderHeaders: Headers;

  beforeEach(async () => {
    const ownerCreated = await createOrganizationUser({ role: Role.owner });
    organization = ownerCreated.context.organization;
    organizationOwner = ownerCreated.context.user;

    ({ entity: otherOrganization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));

    const adminCreated = await createOrganizationUser({ role: Role.admin }, { organization });
    organizationAdmin = adminCreated.context.user;

    const memberCreated = await createOrganizationUser({ role: Role.member }, { organization });
    organizationMember = memberCreated.context.user;

    const viewerCreated = await createOrganizationUser({ role: Role.viewer }, { organization });
    organizationViewer = viewerCreated.context.user;

    ({ entity: outsider } = await createUser());

    ({ entity: organizationIntegration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: Role.member,
    }));
    ({ entity: otherIntegration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: Role.member,
    }));

    ({ entity: repoA } = await createIntegrationResource(
      { kind: 'repository', name: 'inixiative/kingdom' },
      { integration: organizationIntegration },
    ));
    ({ entity: repoB } = await createIntegrationResource(
      { kind: 'repository', name: 'inixiative/template' },
      { integration: organizationIntegration },
    ));
    ({ entity: untrackedRepo } = await createIntegrationResource(
      {
        kind: 'repository',
        name: 'inixiative/archived',
        status: IntegrationResourceStatus.untracked,
      },
      { integration: organizationIntegration },
    ));
    ({ entity: otherRepo } = await createIntegrationResource(
      { kind: 'repository', name: 'inixiative/other' },
      { integration: otherIntegration },
    ));

    ownerHeaders = await jwt(organizationOwner);
    adminHeaders = await jwt(organizationAdmin);
    memberHeaders = await jwt(organizationMember);
    viewerHeaders = await jwt(organizationViewer);
    outsiderHeaders = await jwt(outsider);
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('creates new projects inline and links existing projects with identity and non-identity resources in one transaction', async () => {
    const { entity: existingProject } = await createProject({
      name: 'Existing Team Project',
      ownerModel: 'Organization',
      organizationId: organization.id,
    });

    const response = await request(
      'POST',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          project: { name: 'kingdom', description: 'From GitHub repo' },
          resources: [{ integrationResourceId: repoA.id, isIdentity: true }],
        },
        {
          projectId: existingProject.id,
          resources: [{ integrationResourceId: repoB.id, isIdentity: false }],
        },
      ],
    );

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as {
      data: Array<{
        id: string;
        projectId: string;
        integrationId: string;
        project: Project;
        projectIntegrationResources: Array<{
          id: string;
          integrationResourceId: string;
          projectIntegrationId: string | null;
          isIdentity: boolean;
        }>;
      }>;
    };
    expect(data).toHaveLength(2);

    const createdProjectIntegration = data[0]!;
    expect(createdProjectIntegration.integrationId).toBe(organizationIntegration.id);
    expect(createdProjectIntegration.project.name).toBe('kingdom');
    expect(createdProjectIntegration.project.ownerModel).toBe('Organization');
    expect(createdProjectIntegration.project.organizationId).toBe(organization.id);
    expect(createdProjectIntegration.project.readAccess).toBe(ReadAccess.private);
    expect(createdProjectIntegration.project.operateAccess).toBe(OperateAccess.private);
    expect(createdProjectIntegration.projectIntegrationResources).toHaveLength(1);
    expect(createdProjectIntegration.projectIntegrationResources[0]).toMatchObject({
      integrationResourceId: repoA.id,
      projectIntegrationId: createdProjectIntegration.id,
      isIdentity: true,
    });

    const existingProjectIntegration = data[1]!;
    expect(existingProjectIntegration.projectId).toBe(existingProject.id);
    expect(existingProjectIntegration.projectIntegrationResources).toHaveLength(1);
    expect(existingProjectIntegration.projectIntegrationResources[0]).toMatchObject({
      integrationResourceId: repoB.id,
      projectIntegrationId: existingProjectIntegration.id,
      isIdentity: false,
    });

    // Listing via GET /integration/:id/projectIntegrations returns both to admin
    const listedAdmin = await request(
      'GET',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
    );
    expect(listedAdmin.status).toBe(200);
    const adminBody = (await listedAdmin.json()) as { data: Array<{ id: string }> };
    expect(adminBody.data.map((r) => r.id).sort()).toEqual(
      [createdProjectIntegration.id, existingProjectIntegration.id].sort(),
    );

    // Organization viewer can read the integration, but both projects are private -> sees 0 rows
    const listedViewer = await request(
      'GET',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      viewerHeaders,
    );
    expect(listedViewer.status).toBe(200);
    expect(((await listedViewer.json()) as { data: unknown[] }).data).toEqual([]);

    // Direct db:ProjectIntegration read entitlement without db:Project:read must NOT leak embedded Project
    const directEntitlementToken = await createKeyedToken(
      {
        ownerModel: 'Organization',
        role: null,
        entitlements: [
          entitlementInputFor(
            'db:Integration',
            ['db:Integration', organizationIntegration.id],
            ['read'],
          ),
          entitlementInputFor(
            'db:ProjectIntegration',
            ['db:ProjectIntegration', createdProjectIntegration.id],
            ['read'],
          ),
        ],
      },
      { organization },
    );
    const listedWithDirectEntitlement = await request(
      'GET',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      { authorization: `Bearer ${directEntitlementToken.rawKey}` },
    );
    expect(listedWithDirectEntitlement.status).toBe(200);
    expect(((await listedWithDirectEntitlement.json()) as { data: unknown[] }).data).toEqual([]);

    // Flipping existingProject to readAccess: tenant reveals only existingProjectIntegration to viewer
    await db.project.update({
      where: { id: existingProject.id },
      data: { readAccess: ReadAccess.tenant },
    });
    const listedViewerAfter = await request(
      'GET',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      viewerHeaders,
    );
    expect(listedViewerAfter.status).toBe(200);
    expect(
      ((await listedViewerAfter.json()) as { data: Array<{ id: string }> }).data.map((r) => r.id),
    ).toEqual([existingProjectIntegration.id]);

    // Untracked resources linked to the project are hidden from GET /integration/:id/projectIntegrations
    await createProjectIntegrationResource(
      { projectIntegrationId: existingProjectIntegration.id, isIdentity: false },
      { project: existingProject, integrationResource: untrackedRepo },
    );
    const listedAfterUntracked = await request(
      'GET',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
    );
    const listedExisting = (
      (await listedAfterUntracked.json()) as {
        data: Array<{
          id: string;
          projectIntegrationResources: Array<{ integrationResourceId: string }>;
        }>;
      }
    ).data.find((row) => row.id === existingProjectIntegration.id);
    expect(listedExisting?.projectIntegrationResources.map((r) => r.integrationResourceId)).toEqual(
      [repoB.id],
    );
  });

  it('enforces at most one isIdentity resource per ProjectIntegration while allowing the same resource to be identity on two different projects', async () => {
    const { entity: organizationProject } = await createProject({
      name: 'Org Kingdom',
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: memberProject } = await createProject({
      name: 'Member Sandbox',
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: organizationMember.id,
    });

    const first = await request(
      'POST',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: organizationProject.id,
          resources: [{ integrationResourceId: repoA.id, isIdentity: true }],
        },
      ],
    );
    expect(first.status).toBe(201);

    // Re-sending repoA without isIdentity preserves existing isIdentity: true
    const preserved = await request(
      'POST',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: organizationProject.id,
          resources: [{ integrationResourceId: repoA.id }],
        },
      ],
    );
    expect(preserved.status).toBe(201);
    const preservedBody = (await preserved.json()) as {
      data: Array<{
        projectIntegrationResources: Array<{ integrationResourceId: string; isIdentity: boolean }>;
      }>;
    };
    expect(preservedBody.data[0]!.projectIntegrationResources[0]!.isIdentity).toBe(true);

    // Second isIdentity resource on the same ProjectIntegration -> 409
    const conflict = await request(
      'POST',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: organizationProject.id,
          resources: [{ integrationResourceId: repoB.id, isIdentity: true }],
        },
      ],
    );
    expect(conflict.status).toBe(409);

    // Adding repoB as non-identity on the same ProjectIntegration succeeds
    const nonIdentity = await request(
      'POST',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: organizationProject.id,
          resources: [{ integrationResourceId: repoB.id, isIdentity: false }],
        },
      ],
    );
    expect(nonIdentity.status).toBe(201);

    // Swapping identity from repoA -> repoB in a single call succeeds regardless of array order
    const swapped = await request(
      'POST',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: organizationProject.id,
          resources: [
            { integrationResourceId: repoB.id, isIdentity: true },
            { integrationResourceId: repoA.id, isIdentity: false },
          ],
        },
      ],
    );
    expect(swapped.status).toBe(201);
    const swappedBody = (await swapped.json()) as {
      data: Array<{
        projectIntegrationResources: Array<{ integrationResourceId: string; isIdentity: boolean }>;
      }>;
    };
    const isIdentityByIntegrationResourceId = new Map(
      swappedBody.data[0]!.projectIntegrationResources.map((r) => [
        r.integrationResourceId,
        r.isIdentity,
      ]),
    );
    expect(isIdentityByIntegrationResourceId.get(repoB.id)).toBe(true);
    expect(isIdentityByIntegrationResourceId.get(repoA.id)).toBe(false);

    // Member links the SAME repoA as isIdentity on their OWN OrganizationUser project -> allowed
    const memberLink = await request(
      'POST',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      memberHeaders,
      [
        {
          projectId: memberProject.id,
          resources: [{ integrationResourceId: repoA.id, isIdentity: true }],
        },
      ],
    );
    expect(memberLink.status).toBe(201);

    // Admin listing does NOT see member's private project; owner sees both
    const adminList = await request(
      'GET',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      adminHeaders,
    );
    expect(
      ((await adminList.json()) as { data: Array<{ projectId: string }> }).data.map(
        (r) => r.projectId,
      ),
    ).toEqual([organizationProject.id]);

    const ownerList = await request(
      'GET',
      `/integration/${organizationIntegration.id}/projectIntegrations`,
      ownerHeaders,
    );
    expect(
      ((await ownerList.json()) as { data: Array<{ projectId: string }> }).data
        .map((r) => r.projectId)
        .sort(),
    ).toEqual([memberProject.id, organizationProject.id].sort());
  });

  it('rejects invalid inputs, cross-tenant links, untracked resources, foreign resources, and unauthorized callers', async () => {
    const { entity: otherOrganizationProject } = await createProject({
      ownerModel: 'Organization',
      organizationId: otherOrganization.id,
    });
    const { entity: organizationProject } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });

    // Empty array -> 422
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          adminHeaders,
          [],
        )
      ).status,
    ).toBe(422);

    // Neither projectId nor project -> 422
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          adminHeaders,
          [{}],
        )
      ).status,
    ).toBe(422);

    // Both projectId and project -> 422
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          adminHeaders,
          [{ projectId: organizationProject.id, project: { name: 'Dup' } }],
        )
      ).status,
    ).toBe(422);

    // Two isIdentity resources in one item -> 422
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          adminHeaders,
          [
            {
              projectId: organizationProject.id,
              resources: [
                { integrationResourceId: repoA.id, isIdentity: true },
                { integrationResourceId: repoB.id, isIdentity: true },
              ],
            },
          ],
        )
      ).status,
    ).toBe(422);

    // Foreign integration's resource -> 404
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          adminHeaders,
          [
            {
              projectId: organizationProject.id,
              resources: [{ integrationResourceId: otherRepo.id }],
            },
          ],
        )
      ).status,
    ).toBe(404);

    // Untracked resource -> 403
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          adminHeaders,
          [
            {
              projectId: organizationProject.id,
              resources: [{ integrationResourceId: untrackedRepo.id }],
            },
          ],
        )
      ).status,
    ).toBe(403);

    // Member cannot create org project inline -> 403
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          memberHeaders,
          [{ project: { name: 'Unauthorized Org Project' } }],
        )
      ).status,
    ).toBe(403);

    // Cross-tenant projectId returns uniform 403 (no existence oracle)
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          adminHeaders,
          [{ projectId: otherOrganizationProject.id }],
        )
      ).status,
    ).toBe(403);

    // Outsider cannot call POST or GET -> 403
    expect(
      (
        await request(
          'POST',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          outsiderHeaders,
          [{ projectId: otherOrganizationProject.id }],
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          'GET',
          `/integration/${organizationIntegration.id}/projectIntegrations`,
          outsiderHeaders,
        )
      ).status,
    ).toBe(403);

    // Space-scoped integration on org-scoped project -> 422 from tenant boundary hook
    const { entity: spaceUser } = await createSpaceUser(
      { role: Role.admin },
      {
        organization,
        space,
        user: organizationAdmin,
        organizationUser: await db.organizationUser.findFirstOrThrow({
          where: { organizationId: organization.id, userId: organizationAdmin.id },
        }),
      },
    );
    expect(spaceUser.id).toBeTruthy();
    const { entity: spaceIntegration } = await createIntegration({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
      role: Role.member,
    });
    expect(
      (
        await request(
          'POST',
          `/integration/${spaceIntegration.id}/projectIntegrations`,
          adminHeaders,
          [{ projectId: organizationProject.id }],
        )
      ).status,
    ).toBe(422);
  });

  it('enforces DB invariants on ProjectIntegrationResource including diamond Integration revive, nested disconnect/connect guards, and delete route', async () => {
    const { entity: projectA } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: projectB } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: projectIntegrationA } = await createProjectIntegration(
      {},
      { project: projectA, integration: organizationIntegration },
    );
    const { entity: otherProjectIntegration } = await createProjectIntegration(
      {},
      { project: projectA, integration: otherIntegration },
    );

    // RulesRegistry: isIdentity=true without projectIntegrationId -> 422
    await expect(
      createProjectIntegrationResource(
        { isIdentity: true },
        { project: projectA, integrationResource: repoA },
      ),
    ).rejects.toThrow('requires a ProjectIntegration');

    // Consistency hook: projectIntegrationId pointing to wrong project -> 422
    await expect(
      createProjectIntegrationResource(
        { projectIntegrationId: projectIntegrationA.id },
        { project: projectB, integrationResource: repoA },
      ),
    ).rejects.toThrow('projectId must match');

    // Consistency hook: projectIntegrationId pointing to wrong integration -> 422
    await expect(
      createProjectIntegrationResource(
        { projectIntegrationId: otherProjectIntegration.id },
        { project: projectA, integrationResource: repoA },
      ),
    ).rejects.toThrow('must belong to the same Integration as its ProjectIntegration');

    // Valid linked resource + nested Prisma disconnect/connect guards + DELETE /projectIntegrationResource/:id
    const { entity: projectIntegrationResource } = await createProjectIntegrationResource(
      { projectIntegrationId: projectIntegrationA.id, isIdentity: true },
      { project: projectA, integrationResource: repoA },
    );

    // Nested disconnect on isIdentity=true row -> 422
    await expect(
      db.projectIntegrationResource.update({
        where: { id: projectIntegrationResource.id },
        data: { projectIntegration: { disconnect: true } },
      }),
    ).rejects.toThrow('requires a ProjectIntegration');

    // Nested connect mutating immutable projectId -> 422
    await expect(
      db.projectIntegrationResource.update({
        where: { id: projectIntegrationResource.id },
        data: { project: { connect: { id: projectB.id } } },
      }),
    ).rejects.toThrow('cannot be modified after creation');

    // DELETE route ReBAC + clears isIdentity on soft delete
    expect(
      (
        await request(
          'DELETE',
          `/projectIntegrationResource/${projectIntegrationResource.id}`,
          memberHeaders,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          'DELETE',
          `/projectIntegrationResource/${projectIntegrationResource.id}`,
          adminHeaders,
        )
      ).status,
    ).toBe(204);
    const deletedRow = await db.withDeleted(() =>
      db.projectIntegrationResource.findUniqueOrThrow({
        where: { id: projectIntegrationResource.id },
      }),
    );
    expect(deletedRow.deletedAt).not.toBeNull();
    expect(deletedRow.isIdentity).toBe(false);

    // Soft-deleting and reviving the parent Integration (diamond cascade across IntegrationResource + ProjectIntegration) succeeds
    const { entity: secondProjectIntegrationResource } = await createProjectIntegrationResource(
      { projectIntegrationId: projectIntegrationA.id, isIdentity: true },
      { project: projectA, integrationResource: repoB },
    );
    const { deletedAt } = await db.integration.update({
      where: { id: organizationIntegration.id },
      data: { deletedAt: new Date() },
    });
    const tombstoned = await db.withDeleted(() =>
      db.projectIntegrationResource.findUniqueOrThrow({
        where: { id: secondProjectIntegrationResource.id },
      }),
    );
    expect(tombstoned.deletedAt).toEqual(deletedAt);

    await revive(db.integration, { id: organizationIntegration.id });
    const revived = await db.projectIntegrationResource.findUniqueOrThrow({
      where: { id: secondProjectIntegrationResource.id },
    });
    expect(revived.deletedAt).toBeNull();
    expect(revived.isIdentity).toBe(true);
  });
});
