import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, revive } from '@template/db';
import type {
  Integration,
  IntegrationResource,
  Organization,
  OrganizationUser,
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
import { createUserJwt } from '#tests/utils/createUserJwt';

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
  let otherOrg: Organization;
  let space: Space;
  let orgOwner: User;
  let orgAdmin: User;
  let orgMember: User;
  let orgMemberSeat: OrganizationUser;
  let orgViewer: User;
  let outsider: User;
  let orgIntegration: Integration;
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
    orgOwner = ownerCreated.context.user;

    ({ entity: otherOrg } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));

    const adminCreated = await createOrganizationUser({ role: Role.admin }, { organization });
    orgAdmin = adminCreated.context.user;

    const memberCreated = await createOrganizationUser({ role: Role.member }, { organization });
    orgMember = memberCreated.context.user;
    orgMemberSeat = memberCreated.entity;

    const viewerCreated = await createOrganizationUser({ role: Role.viewer }, { organization });
    orgViewer = viewerCreated.context.user;

    ({ entity: outsider } = await createUser());

    ({ entity: orgIntegration } = await createIntegration({
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
      { integration: orgIntegration },
    ));
    ({ entity: repoB } = await createIntegrationResource(
      { kind: 'repository', name: 'inixiative/template' },
      { integration: orgIntegration },
    ));
    ({ entity: untrackedRepo } = await createIntegrationResource(
      {
        kind: 'repository',
        name: 'inixiative/archived',
        status: IntegrationResourceStatus.untracked,
      },
      { integration: orgIntegration },
    ));
    ({ entity: otherRepo } = await createIntegrationResource(
      { kind: 'repository', name: 'inixiative/other' },
      { integration: otherIntegration },
    ));

    ownerHeaders = await jwt(orgOwner);
    adminHeaders = await jwt(orgAdmin);
    memberHeaders = await jwt(orgMember);
    viewerHeaders = await jwt(orgViewer);
    outsiderHeaders = await jwt(outsider);
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('creates new projects inline and links existing projects with isIdentity and attached resources in one transaction', async () => {
    const { entity: existingProject } = await createProject({
      name: 'Existing Team Project',
      ownerModel: 'Organization',
      organizationId: organization.id,
    });

    const response = await request(
      'POST',
      `/integration/${orgIntegration.id}/projectIntegrations`,
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

    const createdLink = data[0]!;
    expect(createdLink.integrationId).toBe(orgIntegration.id);
    expect(createdLink.project.name).toBe('kingdom');
    expect(createdLink.project.ownerModel).toBe('Organization');
    expect(createdLink.project.organizationId).toBe(organization.id);
    expect(createdLink.project.readAccess).toBe(ReadAccess.private);
    expect(createdLink.project.operateAccess).toBe(OperateAccess.private);
    expect(createdLink.projectIntegrationResources).toHaveLength(1);
    expect(createdLink.projectIntegrationResources[0]).toMatchObject({
      integrationResourceId: repoA.id,
      projectIntegrationId: createdLink.id,
      isIdentity: true,
    });

    const existingLink = data[1]!;
    expect(existingLink.projectId).toBe(existingProject.id);
    expect(existingLink.projectIntegrationResources).toHaveLength(1);
    expect(existingLink.projectIntegrationResources[0]).toMatchObject({
      integrationResourceId: repoB.id,
      projectIntegrationId: existingLink.id,
      isIdentity: false,
    });

    // Listing via GET /integration/:id/projectIntegrations returns both to admin
    const listedAdmin = await request(
      'GET',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      adminHeaders,
    );
    expect(listedAdmin.status).toBe(200);
    const adminBody = (await listedAdmin.json()) as { data: Array<{ id: string }> };
    expect(adminBody.data.map((r) => r.id).sort()).toEqual(
      [createdLink.id, existingLink.id].sort(),
    );

    // Org viewer can read the integration, but both projects are private -> sees 0 rows (no leak!)
    const listedViewer = await request(
      'GET',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      viewerHeaders,
    );
    expect(listedViewer.status).toBe(200);
    expect(((await listedViewer.json()) as { data: unknown[] }).data).toEqual([]);

    // Flipping existingProject to readAccess: tenant reveals only existingLink to viewer
    await db.project.update({
      where: { id: existingProject.id },
      data: { readAccess: ReadAccess.tenant },
    });
    const listedViewerAfter = await request(
      'GET',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      viewerHeaders,
    );
    expect(listedViewerAfter.status).toBe(200);
    expect(
      ((await listedViewerAfter.json()) as { data: Array<{ id: string }> }).data.map((r) => r.id),
    ).toEqual([existingLink.id]);
  });

  it('enforces at most one isIdentity resource per ProjectIntegration while allowing the same resource to be identity on two different projects', async () => {
    const { entity: orgProject } = await createProject({
      name: 'Org Kingdom',
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: memberProject } = await createProject({
      name: 'Member Sandbox',
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: orgMember.id,
    });

    // Admin links repoA as identity on orgProject
    const first = await request(
      'POST',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: orgProject.id,
          resources: [{ integrationResourceId: repoA.id, isIdentity: true }],
        },
      ],
    );
    expect(first.status).toBe(201);

    // Trying to add a second isIdentity resource on the same ProjectIntegration -> 409
    const conflict = await request(
      'POST',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: orgProject.id,
          resources: [{ integrationResourceId: repoB.id, isIdentity: true }],
        },
      ],
    );
    expect(conflict.status).toBe(409);

    // Adding repoB as non-identity (attached) on the same ProjectIntegration succeeds
    const attached = await request(
      'POST',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: orgProject.id,
          resources: [{ integrationResourceId: repoB.id, isIdentity: false }],
        },
      ],
    );
    expect(attached.status).toBe(201);

    // Swapping identity from repoA -> repoB in a single call succeeds regardless of array order
    const swapped = await request(
      'POST',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      adminHeaders,
      [
        {
          projectId: orgProject.id,
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
    const byResId = new Map(
      swappedBody.data[0]!.projectIntegrationResources.map((r) => [
        r.integrationResourceId,
        r.isIdentity,
      ]),
    );
    expect(byResId.get(repoB.id)).toBe(true);
    expect(byResId.get(repoA.id)).toBe(false);

    // Member links the SAME repoA as isIdentity on their OWN OrganizationUser project -> allowed (separate ProjectIntegration)
    const memberLink = await request(
      'POST',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      memberHeaders,
      [
        {
          projectId: memberProject.id,
          resources: [{ integrationResourceId: repoA.id, isIdentity: true }],
        },
      ],
    );
    expect(memberLink.status).toBe(201);

    // Admin listing does NOT see member's private project link; org owner sees both
    const adminList = await request(
      'GET',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      adminHeaders,
    );
    expect(
      ((await adminList.json()) as { data: Array<{ projectId: string }> }).data.map(
        (r) => r.projectId,
      ),
    ).toEqual([orgProject.id]);

    const ownerList = await request(
      'GET',
      `/integration/${orgIntegration.id}/projectIntegrations`,
      ownerHeaders,
    );
    expect(
      ((await ownerList.json()) as { data: Array<{ projectId: string }> }).data
        .map((r) => r.projectId)
        .sort(),
    ).toEqual([memberProject.id, orgProject.id].sort());
  });

  it('rejects invalid inputs, cross-tenant links, untracked resources, foreign resources, and unauthorized callers', async () => {
    const { entity: otherOrgProject } = await createProject({
      ownerModel: 'Organization',
      organizationId: otherOrg.id,
    });
    const { entity: orgProject } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: memberIntegration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: orgMember.id,
      role: Role.member,
    });

    // Empty array -> 422
    expect(
      (
        await request(
          'POST',
          `/integration/${orgIntegration.id}/projectIntegrations`,
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
          `/integration/${orgIntegration.id}/projectIntegrations`,
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
          `/integration/${orgIntegration.id}/projectIntegrations`,
          adminHeaders,
          [{ projectId: orgProject.id, project: { name: 'Dup' } }],
        )
      ).status,
    ).toBe(422);

    // Two isIdentity resources in one item -> 422
    expect(
      (
        await request(
          'POST',
          `/integration/${orgIntegration.id}/projectIntegrations`,
          adminHeaders,
          [
            {
              projectId: orgProject.id,
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
          `/integration/${orgIntegration.id}/projectIntegrations`,
          adminHeaders,
          [{ projectId: orgProject.id, resources: [{ integrationResourceId: otherRepo.id }] }],
        )
      ).status,
    ).toBe(404);

    // Untracked resource -> 403 (ReBAC db:ProjectIntegrationResource.create requires tracked/missing)
    expect(
      (
        await request(
          'POST',
          `/integration/${orgIntegration.id}/projectIntegrations`,
          adminHeaders,
          [{ projectId: orgProject.id, resources: [{ integrationResourceId: untrackedRepo.id }] }],
        )
      ).status,
    ).toBe(403);

    // Member cannot create org project inline -> 403
    expect(
      (
        await request(
          'POST',
          `/integration/${orgIntegration.id}/projectIntegrations`,
          memberHeaders,
          [{ project: { name: 'Unauthorized Org Project' } }],
        )
      ).status,
    ).toBe(403);

    // Outsider cannot call POST or GET -> 403
    expect(
      (
        await request(
          'POST',
          `/integration/${orgIntegration.id}/projectIntegrations`,
          outsiderHeaders,
          [{ projectId: otherOrgProject.id }],
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          'GET',
          `/integration/${orgIntegration.id}/projectIntegrations`,
          outsiderHeaders,
        )
      ).status,
    ).toBe(403);

    // Member-owned integration cannot link to org-owned project (projectIntegrationOwner hook -> 422)
    // Owner can operate/manage orgProject & memberIntegration? No, member owns memberIntegration, admin/owner can't operate memberIntegration (403);
    // test with space-scoped integration on org-scoped project (admin manages both -> 422 from tenant boundary hook!)
    const { entity: spaceUser } = await createSpaceUser(
      { role: Role.admin },
      {
        organization,
        space,
        user: orgAdmin,
        organizationUser: await db.organizationUser.findFirstOrThrow({
          where: { organizationId: organization.id, userId: orgAdmin.id },
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
          [{ projectId: orgProject.id }],
        )
      ).status,
    ).toBe(422);

    // Suppress unused check
    expect(memberIntegration.id).toBeTruthy();
    expect(orgMemberSeat.id).toBeTruthy();
  });

  it('enforces DB invariants on ProjectIntegrationResource (isIdentity requires projectIntegrationId, consistency hook, cascade & delete route)', async () => {
    const { entity: projectA } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: projectB } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: linkA } = await createProjectIntegration(
      {},
      { project: projectA, integration: orgIntegration },
    );
    const { entity: linkOtherInt } = await createProjectIntegration(
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
        { projectIntegrationId: linkA.id },
        { project: projectB, integrationResource: repoA },
      ),
    ).rejects.toThrow('projectId must match');

    // Consistency hook: projectIntegrationId pointing to wrong integration -> 422
    await expect(
      createProjectIntegrationResource(
        { projectIntegrationId: linkOtherInt.id },
        { project: projectA, integrationResource: repoA },
      ),
    ).rejects.toThrow('must belong to its ProjectIntegration');

    // Valid linked resource + DELETE /projectIntegrationResource/:id ReBAC
    const { entity: resLink } = await createProjectIntegrationResource(
      { projectIntegrationId: linkA.id, isIdentity: true },
      { project: projectA, integrationResource: repoA },
    );
    expect(
      (await request('DELETE', `/projectIntegrationResource/${resLink.id}`, memberHeaders)).status,
    ).toBe(403);
    expect(
      (await request('DELETE', `/projectIntegrationResource/${resLink.id}`, adminHeaders)).status,
    ).toBe(204);
    expect(
      await db.projectIntegrationResource.findUnique({ where: { id: resLink.id } }),
    ).toBeNull();

    // Soft-deleting ProjectIntegration cascades to its ProjectIntegrationResource, and reviving brings it back
    const { entity: resLink2 } = await createProjectIntegrationResource(
      { projectIntegrationId: linkA.id, isIdentity: true },
      { project: projectA, integrationResource: repoB },
    );
    const { deletedAt } = await db.projectIntegration.update({
      where: { id: linkA.id },
      data: { deletedAt: new Date() },
    });
    const tombstoned = await db.withDeleted(() =>
      db.projectIntegrationResource.findUniqueOrThrow({ where: { id: resLink2.id } }),
    );
    expect(tombstoned.deletedAt).toEqual(deletedAt);

    await revive(db.projectIntegration, { id: linkA.id });
    const revived = await db.projectIntegrationResource.findUniqueOrThrow({
      where: { id: resLink2.id },
    });
    expect(revived.deletedAt).toBeNull();
  });
});
