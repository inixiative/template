import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Project,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import { OperateAccess, PlatformRole, ReadAccess, Role } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createProject,
  createProjectIntegration,
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

const bearer = (rawKey: string): Headers => ({ authorization: `Bearer ${rawKey}` });

const request = (method: string, path: string, headers: Headers = {}, body?: unknown) =>
  app.request(`/api/v1${path}`, {
    method,
    headers: {
      ...headers,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const listIds = async (path: string, headers: Headers = {}) => {
  const response = await request('GET', path, headers);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { data: Project[]; pagination: { total: number } };
  return {
    ids: body.data.map((project) => project.id).sort(),
    total: body.pagination.total,
  };
};

describe('Project access (ReadAccess × OperateAccess)', () => {
  let organization: Organization;
  let space: Space;
  let otherSpace: Space;
  let orgOwnerUser: User;
  let orgAdminUser: User;
  let orgAdminSeat: OrganizationUser;
  let orgMemberUser: User;
  let orgMemberSeat: OrganizationUser;
  let orgViewerUser: User;
  let spaceOwnerUser: User;
  let spaceAdminUser: User;
  let spaceAdminSeat: SpaceUser;
  let spaceMemberUser: User;
  let spaceMemberSeat: SpaceUser;
  let spaceViewerUser: User;
  let outsiderUser: User;
  let superadminUser: User;
  let headers: Record<string, Headers>;

  beforeEach(async () => {
    const ownerCreated = await createOrganizationUser({ role: Role.owner });
    organization = ownerCreated.context.organization;
    orgOwnerUser = ownerCreated.context.user;

    ({ entity: space } = await createSpace({}, { organization }));
    ({ entity: otherSpace } = await createSpace({}, { organization }));

    const adminCreated = await createOrganizationUser({ role: Role.admin }, { organization });
    orgAdminUser = adminCreated.context.user;
    orgAdminSeat = adminCreated.entity;

    const memberCreated = await createOrganizationUser({ role: Role.member }, { organization });
    orgMemberUser = memberCreated.context.user;
    orgMemberSeat = memberCreated.entity;

    const viewerCreated = await createOrganizationUser({ role: Role.viewer }, { organization });
    orgViewerUser = viewerCreated.context.user;

    const makeSpaceSeat = async (spaceRole: Role) => {
      const orgSeat = await createOrganizationUser({ role: Role.member }, { organization });
      const spSeat = await createSpaceUser(
        { role: spaceRole },
        { organization, space, user: orgSeat.context.user, organizationUser: orgSeat.entity },
      );
      return { user: orgSeat.context.user, seat: spSeat.entity };
    };

    spaceOwnerUser = (await makeSpaceSeat(Role.owner)).user;
    const spAdmin = await makeSpaceSeat(Role.admin);
    spaceAdminUser = spAdmin.user;
    spaceAdminSeat = spAdmin.seat;
    const spMember = await makeSpaceSeat(Role.member);
    spaceMemberUser = spMember.user;
    spaceMemberSeat = spMember.seat;
    spaceViewerUser = (await makeSpaceSeat(Role.viewer)).user;

    const outsiderCreated = await createOrganizationUser({ role: Role.owner });
    outsiderUser = outsiderCreated.context.user;
    const foreignToken = await createKeyedToken(
      { ownerModel: 'Organization', role: Role.viewer },
      { organization: outsiderCreated.context.organization },
    );

    const ownerViewerToken = await createKeyedToken(
      { ownerModel: 'User', role: Role.viewer },
      { user: orgOwnerUser },
    );

    superadminUser = (await createUser({ platformRole: PlatformRole.superadmin })).entity;

    headers = {
      anon: {},
      outsider: await jwt(outsiderUser),
      foreignToken: bearer(foreignToken.rawKey),
      ownerViewerToken: bearer(ownerViewerToken.rawKey),
      orgOwner: await jwt(orgOwnerUser),
      orgAdmin: await jwt(orgAdminUser),
      orgMember: await jwt(orgMemberUser),
      orgViewer: await jwt(orgViewerUser),
      spaceOwner: await jwt(spaceOwnerUser),
      spaceAdmin: await jwt(spaceAdminUser),
      spaceMember: await jwt(spaceMemberUser),
      spaceViewer: await jwt(spaceViewerUser),
      superadmin: await jwt(superadminUser),
    };
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('defaults readAccess and operateAccess to private, requires manage to update, and rejects tenant access on User projects with 422', async () => {
    const createdDefault = await request(
      'POST',
      `/organization/${organization.id}/projects`,
      headers.orgAdmin,
      { name: 'Default Private' },
    );
    expect(createdDefault.status).toBe(201);
    const { data: project } = (await createdDefault.json()) as { data: Project };
    expect(project.readAccess).toBe(ReadAccess.private);
    expect(project.operateAccess).toBe(OperateAccess.private);

    const createdTenant = await request(
      'POST',
      `/organization/${organization.id}/projects`,
      headers.orgAdmin,
      {
        name: 'Explicit Tenant',
        readAccess: ReadAccess.tenant,
        operateAccess: OperateAccess.tenant,
      },
    );
    expect(createdTenant.status).toBe(201);
    const tenantProject = ((await createdTenant.json()) as { data: Project }).data;
    expect(tenantProject.readAccess).toBe(ReadAccess.tenant);
    expect(tenantProject.operateAccess).toBe(OperateAccess.tenant);

    expect(
      (
        await request('PATCH', `/project/${project.id}`, headers.orgMember, {
          readAccess: ReadAccess.public,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request('PATCH', `/project/${project.id}`, headers.anon, {
          readAccess: ReadAccess.public,
        })
      ).status,
    ).toBe(403);

    const updated = await request('PATCH', `/project/${project.id}`, headers.orgAdmin, {
      readAccess: ReadAccess.public,
      operateAccess: OperateAccess.tenant,
    });
    expect(updated.status).toBe(200);
    const updatedProject = ((await updated.json()) as { data: Project }).data;
    expect(updatedProject.readAccess).toBe(ReadAccess.public);
    expect(updatedProject.operateAccess).toBe(OperateAccess.tenant);

    expect(
      (
        await request('POST', '/me/projects', headers.orgOwner, {
          name: 'Bad User Tenant Read',
          readAccess: ReadAccess.tenant,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await request('POST', '/me/projects', headers.orgOwner, {
          name: 'Bad User Tenant Operate',
          operateAccess: OperateAccess.tenant,
        })
      ).status,
    ).toBe(422);

    const createdDefaultUserProject = await request('POST', '/me/projects', headers.orgOwner, {
      name: 'User Default Private',
    });
    expect(createdDefaultUserProject.status).toBe(201);
    const defaultUserProject = ((await createdDefaultUserProject.json()) as { data: Project }).data;
    expect(defaultUserProject.readAccess).toBe(ReadAccess.private);
    expect(defaultUserProject.operateAccess).toBe(OperateAccess.private);

    const createdUserProject = await request('POST', '/me/projects', headers.orgOwner, {
      name: 'User Public',
      readAccess: ReadAccess.public,
    });
    expect(createdUserProject.status).toBe(201);
    const userProject = ((await createdUserProject.json()) as { data: Project }).data;
    expect(userProject.readAccess).toBe(ReadAccess.public);
    expect(userProject.operateAccess).toBe(OperateAccess.private);

    expect(
      (
        await request('PATCH', `/project/${userProject.id}`, headers.orgOwner, {
          readAccess: ReadAccess.tenant,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await request('PATCH', `/project/${userProject.id}`, headers.orgOwner, {
          operateAccess: OperateAccess.tenant,
        })
      ).status,
    ).toBe(422);
  });

  it('GET /project/:id enforces readAccess and operateAccess across all five owner models', async () => {
    const makeTenantSet = async (
      fields: Partial<Pick<Project, 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>>,
    ) => {
      const priv = (
        await createProject({
          ...fields,
          readAccess: ReadAccess.private,
          operateAccess: OperateAccess.private,
        })
      ).entity;
      const tenantRead = (
        await createProject({
          ...fields,
          readAccess: ReadAccess.tenant,
          operateAccess: OperateAccess.private,
        })
      ).entity;
      const membersOnly = (
        await createProject({
          ...fields,
          readAccess: ReadAccess.private,
          operateAccess: OperateAccess.tenant,
        })
      ).entity;
      const pub = (
        await createProject({
          ...fields,
          readAccess: ReadAccess.public,
          operateAccess: OperateAccess.private,
        })
      ).entity;
      return { priv, tenantRead, membersOnly, pub };
    };

    const orgProjects = await makeTenantSet({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    expect(
      (await request('GET', `/project/${orgProjects.priv.id}`, headers.orgMember)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${orgProjects.priv.id}`, headers.orgViewer)).status,
    ).toBe(403);
    expect((await request('GET', `/project/${orgProjects.priv.id}`, headers.orgAdmin)).status).toBe(
      200,
    );
    expect(
      (await request('GET', `/project/${orgProjects.tenantRead.id}`, headers.orgViewer)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${orgProjects.tenantRead.id}`, headers.outsider)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${orgProjects.tenantRead.id}`, headers.anon)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${orgProjects.membersOnly.id}`, headers.orgViewer)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${orgProjects.membersOnly.id}`, headers.orgMember)).status,
    ).toBe(200);
    expect(
      (await request('DELETE', `/project/${orgProjects.membersOnly.id}`, headers.orgMember)).status,
    ).toBe(403);
    expect((await request('GET', `/project/${orgProjects.pub.id}`, headers.anon)).status).toBe(200);
    expect((await request('GET', `/project/${orgProjects.pub.id}`, headers.outsider)).status).toBe(
      200,
    );
    expect(
      (await request('GET', `/project/${orgProjects.pub.id}`, headers.foreignToken)).status,
    ).toBe(200);
    expect(
      (
        await request('PATCH', `/project/${orgProjects.pub.id}`, headers.foreignToken, {
          name: 'x',
        })
      ).status,
    ).toBe(403);
    expect(
      (await request('DELETE', `/project/${orgProjects.pub.id}`, headers.orgMember)).status,
    ).toBe(403);
    expect((await request('DELETE', `/project/${orgProjects.pub.id}`, headers.anon)).status).toBe(
      403,
    );

    const spaceProjects = await makeTenantSet({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });
    expect(
      (await request('GET', `/project/${spaceProjects.priv.id}`, headers.spaceMember)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceProjects.priv.id}`, headers.spaceAdmin)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${spaceProjects.priv.id}`, headers.orgOwner)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${spaceProjects.tenantRead.id}`, headers.spaceViewer)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${spaceProjects.tenantRead.id}`, headers.orgAdmin)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceProjects.membersOnly.id}`, headers.spaceViewer))
        .status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceProjects.membersOnly.id}`, headers.spaceMember))
        .status,
    ).toBe(200);
    expect((await request('GET', `/project/${spaceProjects.pub.id}`, headers.anon)).status).toBe(
      200,
    );

    const otherSpaceTenant = (
      await createProject({
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: otherSpace.id,
        readAccess: ReadAccess.tenant,
      })
    ).entity;
    expect(
      (await request('GET', `/project/${otherSpaceTenant.id}`, headers.spaceAdmin)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${otherSpaceTenant.id}`, headers.spaceMember)).status,
    ).toBe(403);
    expect((await request('GET', `/project/${otherSpaceTenant.id}`, headers.orgOwner)).status).toBe(
      200,
    );

    const memberProjects = await makeTenantSet({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: orgMemberUser.id,
    });
    expect(
      (await request('GET', `/project/${memberProjects.priv.id}`, headers.orgAdmin)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${memberProjects.priv.id}`, headers.orgViewer)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${memberProjects.priv.id}`, headers.orgOwner)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${memberProjects.priv.id}`, headers.orgMember)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${memberProjects.tenantRead.id}`, headers.orgViewer)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${memberProjects.tenantRead.id}`, headers.orgAdmin)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${memberProjects.tenantRead.id}`, headers.outsider)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${memberProjects.membersOnly.id}`, headers.orgViewer)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${memberProjects.membersOnly.id}`, headers.orgAdmin)).status,
    ).toBe(200);
    expect(
      (
        await request('PATCH', `/project/${memberProjects.membersOnly.id}`, headers.orgAdmin, {
          name: 'x',
        })
      ).status,
    ).toBe(403);
    expect(
      (await request('DELETE', `/project/${memberProjects.membersOnly.id}`, headers.orgAdmin))
        .status,
    ).toBe(403);
    expect((await request('GET', `/project/${memberProjects.pub.id}`, headers.anon)).status).toBe(
      200,
    );

    const spaceMemberProjects = await makeTenantSet({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceMemberUser.id,
    });
    expect(
      (await request('GET', `/project/${spaceMemberProjects.priv.id}`, headers.spaceAdmin)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.priv.id}`, headers.spaceOwner)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.priv.id}`, headers.orgOwner)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.tenantRead.id}`, headers.spaceViewer))
        .status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.tenantRead.id}`, headers.orgAdmin))
        .status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.membersOnly.id}`, headers.spaceViewer))
        .status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.membersOnly.id}`, headers.spaceAdmin))
        .status,
    ).toBe(200);
    expect(
      (
        await request(
          'PATCH',
          `/project/${spaceMemberProjects.membersOnly.id}`,
          headers.spaceAdmin,
          { name: 'x' },
        )
      ).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.pub.id}`, headers.anon)).status,
    ).toBe(200);

    const userPriv = (
      await createProject({
        ownerModel: 'User',
        userId: orgOwnerUser.id,
        readAccess: ReadAccess.private,
      })
    ).entity;
    const userPub = (
      await createProject({
        ownerModel: 'User',
        userId: orgOwnerUser.id,
        readAccess: ReadAccess.public,
      })
    ).entity;
    expect((await request('GET', `/project/${userPriv.id}`, headers.ownerViewerToken)).status).toBe(
      200,
    );
    expect((await request('GET', `/project/${userPriv.id}`, headers.outsider)).status).toBe(403);
    expect((await request('GET', `/project/${userPub.id}`, headers.anon)).status).toBe(200);
  });

  it('explicit entitlements on db:Project open private projects on single-record read and owner lists, without leaking unmatched where clauses', async () => {
    const { entity: grantedPriv } = await createProject({
      name: 'Allowed Private',
      ownerModel: 'Organization',
      organizationId: organization.id,
      readAccess: ReadAccess.private,
      operateAccess: OperateAccess.private,
    });
    const { entity: otherPriv } = await createProject({
      name: 'Hidden Private',
      ownerModel: 'Organization',
      organizationId: organization.id,
      readAccess: ReadAccess.private,
      operateAccess: OperateAccess.private,
    });
    const { entity: mismatchedPriv } = await createProject({
      name: 'Renamed Later',
      ownerModel: 'Organization',
      organizationId: organization.id,
      readAccess: ReadAccess.private,
      operateAccess: OperateAccess.private,
    });
    const { entity: pub } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
      readAccess: ReadAccess.public,
      operateAccess: OperateAccess.private,
    });

    const grantedSeat = await createOrganizationUser(
      {
        role: Role.viewer,
        entitlements: [
          entitlementInputFor('db:Project', ['db:Project', grantedPriv.id], ['operate']),
          {
            ...entitlementInputFor('db:Project', ['db:Project', mismatchedPriv.id], ['read']),
            where: { field: 'name', operator: 'equals', value: 'Old Name' },
          },
        ],
      },
      { organization },
    );
    const grantedHeaders = await jwt(grantedSeat.context.user);

    expect((await request('GET', `/project/${grantedPriv.id}`, grantedHeaders)).status).toBe(200);
    expect((await request('GET', `/project/${otherPriv.id}`, grantedHeaders)).status).toBe(403);
    expect((await request('GET', `/project/${mismatchedPriv.id}`, grantedHeaders)).status).toBe(
      403,
    );
    expect(
      (await request('PATCH', `/project/${grantedPriv.id}`, grantedHeaders, { name: 'x' })).status,
    ).toBe(403);

    expect(await listIds(`/organization/${organization.id}/projects`, grantedHeaders)).toEqual({
      ids: [grantedPriv.id, pub.id].sort(),
      total: 2,
    });
    expect(
      await listIds(
        `/organization/${organization.id}/projects?searchFields[readAccess]=private`,
        grantedHeaders,
      ),
    ).toEqual({
      ids: [grantedPriv.id],
      total: 1,
    });

    const { entity: tenantReadOnly } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
      readAccess: ReadAccess.tenant,
      operateAccess: OperateAccess.private,
    });
    const { entity: tenantTeam } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
      readAccess: ReadAccess.tenant,
      operateAccess: OperateAccess.tenant,
    });

    const privateOnlyToken = await createKeyedToken(
      {
        ownerModel: 'Organization',
        role: null,
        entitlements: [
          {
            ...entitlementInputFor(
              'db:Project',
              ['db:Organization', organization.id, 'organization'],
              ['read'],
            ),
            where: {
              all: [
                { field: 'ownerModel', operator: 'equals', value: 'Organization' },
                { field: 'readAccess', operator: 'equals', value: ReadAccess.private },
              ],
            },
          },
        ],
      },
      { organization },
    );
    expect(
      await listIds(`/organization/${organization.id}/projects`, bearer(privateOnlyToken.rawKey)),
    ).toEqual({
      ids: [grantedPriv.id, otherPriv.id, mismatchedPriv.id, pub.id].sort(),
      total: 4,
    });

    const tenantReadOnlyToken = await createKeyedToken(
      {
        ownerModel: 'Organization',
        role: null,
        entitlements: [
          {
            ...entitlementInputFor(
              'db:Project',
              ['db:Organization', organization.id, 'organization'],
              ['read'],
            ),
            where: {
              all: [
                { field: 'ownerModel', operator: 'equals', value: 'Organization' },
                { field: 'readAccess', operator: 'equals', value: ReadAccess.tenant },
                { field: 'operateAccess', operator: 'equals', value: OperateAccess.private },
              ],
            },
          },
        ],
      },
      { organization },
    );
    expect(
      await listIds(
        `/organization/${organization.id}/projects`,
        bearer(tenantReadOnlyToken.rawKey),
      ),
    ).toEqual({
      ids: [tenantReadOnly.id, pub.id].sort(),
      total: 2,
    });
    expect(
      (await request('GET', `/project/${tenantTeam.id}`, bearer(tenantReadOnlyToken.rawKey)))
        .status,
    ).toBe(403);
  });

  it('refuses laundering transient readAccess or operateAccess into permanent self-anchored entitlements while permitting legitimate owner/admin grants', async () => {
    const { entity: memberTenantRead } = await createProject({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: orgMemberUser.id,
      readAccess: ReadAccess.tenant,
      operateAccess: OperateAccess.private,
    });
    const { entity: memberTenantOperate } = await createProject({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: orgMemberUser.id,
      readAccess: ReadAccess.private,
      operateAccess: OperateAccess.tenant,
    });
    const { entity: spacePublic } = await createProject({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
      readAccess: ReadAccess.public,
      operateAccess: OperateAccess.private,
    });
    const { entity: spaceMemberTenant } = await createProject({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceMemberUser.id,
      readAccess: ReadAccess.tenant,
      operateAccess: OperateAccess.tenant,
    });
    const { entity: orgPrivate } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
      readAccess: ReadAccess.private,
      operateAccess: OperateAccess.private,
    });
    const { entity: orgIntegration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: memberLink } = await createProjectIntegration(
      {},
      { project: memberTenantRead, integration: orgIntegration },
    );

    expect(
      (
        await request(
          'POST',
          `/organizationUser/${orgAdminSeat.id}/entitlements`,
          headers.orgAdmin,
          [entitlementInputFor('db:Project', ['db:Project', memberTenantRead.id], ['read'])],
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await request(
          'POST',
          `/organizationUser/${orgAdminSeat.id}/entitlements`,
          headers.orgAdmin,
          [entitlementInputFor('db:Project', ['db:Project', memberTenantOperate.id], ['operate'])],
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await request(
          'POST',
          `/organizationUser/${orgAdminSeat.id}/entitlements`,
          headers.orgAdmin,
          [entitlementInputFor('db:Project', ['db:Project', spacePublic.id], ['read'])],
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await request('POST', `/spaceUser/${spaceAdminSeat.id}/entitlements`, headers.spaceAdmin, [
          entitlementInputFor('db:Project', ['db:Project', spaceMemberTenant.id], ['operate']),
        ])
      ).status,
    ).toBe(403);

    expect(
      (
        await request(
          'POST',
          `/organizationUser/${orgAdminSeat.id}/entitlements`,
          headers.orgAdmin,
          [
            entitlementInputFor(
              'db:ProjectIntegration',
              ['db:Project', memberTenantRead.id, 'project'],
              ['read'],
            ),
          ],
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await request(
          'POST',
          `/organizationUser/${orgAdminSeat.id}/entitlements`,
          headers.orgAdmin,
          [
            entitlementInputFor(
              'db:ProjectIntegration',
              ['db:ProjectIntegration', memberLink.id],
              ['read'],
            ),
          ],
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await request(
          'POST',
          `/organizationUser/${orgMemberSeat.id}/entitlements`,
          headers.orgAdmin,
          [entitlementInputFor('db:Project', ['db:Project', orgPrivate.id], ['read'])],
        )
      ).status,
    ).toBe(201);

    expect(
      (
        await request(
          'POST',
          `/organizationUser/${orgAdminSeat.id}/entitlements`,
          headers.orgOwner,
          [entitlementInputFor('db:Project', ['db:Project', memberTenantRead.id], ['read'])],
        )
      ).status,
    ).toBe(201);
  });

  it('reflects readAccess and operateAccess in SQL across all six owner list routes and resists bracket filter bypasses', async () => {
    const createTenantQuad = async (
      fields: Partial<Pick<Project, 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>>,
    ) => {
      const priv = (
        await createProject({
          ...fields,
          readAccess: ReadAccess.private,
          operateAccess: OperateAccess.private,
        })
      ).entity.id;
      const tenantRead = (
        await createProject({
          ...fields,
          readAccess: ReadAccess.tenant,
          operateAccess: OperateAccess.private,
        })
      ).entity.id;
      const membersOnly = (
        await createProject({
          ...fields,
          readAccess: ReadAccess.private,
          operateAccess: OperateAccess.tenant,
        })
      ).entity.id;
      const pub = (
        await createProject({
          ...fields,
          readAccess: ReadAccess.public,
          operateAccess: OperateAccess.private,
        })
      ).entity.id;
      return {
        priv,
        pubOnly: [pub],
        viewerVisible: [tenantRead, pub].sort(),
        memberVisible: [tenantRead, membersOnly, pub].sort(),
        all: [priv, tenantRead, membersOnly, pub].sort(),
      };
    };

    const orgSet = await createTenantQuad({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const orgPath = `/organization/${organization.id}/projects`;
    expect(await listIds(orgPath, headers.anon)).toEqual({ ids: orgSet.pubOnly, total: 1 });
    expect(await listIds(orgPath, headers.outsider)).toEqual({ ids: orgSet.pubOnly, total: 1 });
    expect(await listIds(orgPath, headers.foreignToken)).toEqual({
      ids: orgSet.pubOnly,
      total: 1,
    });
    expect(await listIds(orgPath, headers.orgViewer)).toEqual({
      ids: orgSet.viewerVisible,
      total: 2,
    });
    expect(await listIds(orgPath, headers.orgMember)).toEqual({
      ids: orgSet.memberVisible,
      total: 3,
    });
    expect(await listIds(orgPath, headers.orgAdmin)).toEqual({ ids: orgSet.all, total: 4 });
    expect(await listIds(orgPath, headers.superadmin)).toEqual({ ids: orgSet.all, total: 4 });

    expect(await listIds(`${orgPath}?searchFields[readAccess]=private`, headers.outsider)).toEqual({
      ids: [],
      total: 0,
    });
    expect(
      await listIds(
        `${orgPath}?searchFields[OR][0][readAccess]=private&searchFields[OR][1][readAccess]=tenant`,
        headers.outsider,
      ),
    ).toEqual({ ids: [], total: 0 });
    expect(await listIds(`${orgPath}?searchFields[readAccess]=private`, headers.orgViewer)).toEqual(
      {
        ids: [],
        total: 0,
      },
    );
    expect(await listIds(`${orgPath}?searchFields[readAccess]=private`, headers.orgMember)).toEqual(
      {
        ids: orgSet.memberVisible.filter((id) => !orgSet.viewerVisible.includes(id)),
        total: 1,
      },
    );
    expect(
      await listIds(
        `${orgPath}?searchFields[readAccess]=private&searchFields[operateAccess]=private`,
        headers.orgAdmin,
      ),
    ).toEqual({
      ids: [orgSet.priv],
      total: 1,
    });

    const spaceSet = await createTenantQuad({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });
    const spacePath = `/space/${space.id}/projects`;
    expect(await listIds(spacePath, headers.anon)).toEqual({ ids: spaceSet.pubOnly, total: 1 });
    expect(await listIds(spacePath, headers.orgAdmin)).toEqual({ ids: spaceSet.pubOnly, total: 1 });
    expect(await listIds(spacePath, headers.spaceViewer)).toEqual({
      ids: spaceSet.viewerVisible,
      total: 2,
    });
    expect(await listIds(spacePath, headers.spaceMember)).toEqual({
      ids: spaceSet.memberVisible,
      total: 3,
    });
    expect(await listIds(spacePath, headers.spaceAdmin)).toEqual({ ids: spaceSet.all, total: 4 });
    expect(await listIds(spacePath, headers.orgOwner)).toEqual({ ids: spaceSet.all, total: 4 });

    const otherSpaceSet = await createTenantQuad({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: otherSpace.id,
    });
    expect(await listIds(`/space/${otherSpace.id}/projects`, headers.spaceAdmin)).toEqual({
      ids: otherSpaceSet.pubOnly,
      total: 1,
    });

    const orgUserSet = await createTenantQuad({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: orgMemberUser.id,
    });
    const orgUserPath = `/organizationUser/${orgMemberSeat.id}/projects`;
    expect(await listIds(orgUserPath, headers.anon)).toEqual({ ids: orgUserSet.pubOnly, total: 1 });
    expect(await listIds(orgUserPath, headers.outsider)).toEqual({
      ids: orgUserSet.pubOnly,
      total: 1,
    });
    expect(await listIds(orgUserPath, headers.orgViewer)).toEqual({
      ids: orgUserSet.viewerVisible,
      total: 2,
    });
    expect(await listIds(orgUserPath, headers.orgAdmin)).toEqual({
      ids: orgUserSet.memberVisible,
      total: 3,
    });
    expect(await listIds(orgUserPath, headers.orgMember)).toEqual({
      ids: orgUserSet.all,
      total: 4,
    });
    expect(await listIds(orgUserPath, headers.orgOwner)).toEqual({
      ids: orgUserSet.all,
      total: 4,
    });
    expect(
      await listIds(
        `${orgUserPath}?searchFields[readAccess]=private&searchFields[operateAccess]=private`,
        headers.orgAdmin,
      ),
    ).toEqual({
      ids: [],
      total: 0,
    });

    const spaceUserSet = await createTenantQuad({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceMemberUser.id,
    });
    const spaceUserPath = `/spaceUser/${spaceMemberSeat.id}/projects`;
    expect(await listIds(spaceUserPath, headers.anon)).toEqual({
      ids: spaceUserSet.pubOnly,
      total: 1,
    });
    expect(await listIds(spaceUserPath, headers.orgAdmin)).toEqual({
      ids: spaceUserSet.pubOnly,
      total: 1,
    });
    expect(await listIds(spaceUserPath, headers.spaceViewer)).toEqual({
      ids: spaceUserSet.viewerVisible,
      total: 2,
    });
    expect(await listIds(spaceUserPath, headers.spaceAdmin)).toEqual({
      ids: spaceUserSet.memberVisible,
      total: 3,
    });
    expect(await listIds(spaceUserPath, headers.spaceMember)).toEqual({
      ids: spaceUserSet.all,
      total: 4,
    });
    expect(await listIds(spaceUserPath, headers.spaceOwner)).toEqual({
      ids: spaceUserSet.all,
      total: 4,
    });
    expect(await listIds(spaceUserPath, headers.orgOwner)).toEqual({
      ids: spaceUserSet.all,
      total: 4,
    });

    const userPriv = (
      await createProject({
        ownerModel: 'User',
        userId: orgOwnerUser.id,
        readAccess: ReadAccess.private,
      })
    ).entity.id;
    const userPub = (
      await createProject({
        ownerModel: 'User',
        userId: orgOwnerUser.id,
        readAccess: ReadAccess.public,
      })
    ).entity.id;
    const userAll = [userPriv, userPub].sort();

    expect(await listIds('/me/projects', headers.orgOwner)).toEqual({ ids: userAll, total: 2 });
    expect(await listIds('/me/projects', headers.ownerViewerToken)).toEqual({
      ids: userAll,
      total: 2,
    });
    const entitlementOnlyUserToken = await createKeyedToken(
      {
        ownerModel: 'User',
        role: null,
        entitlements: [entitlementInputFor('db:Project', ['db:Project', userPriv], ['read'])],
      },
      { user: orgOwnerUser },
    );
    expect(await listIds('/me/projects', bearer(entitlementOnlyUserToken.rawKey))).toEqual({
      ids: userAll,
      total: 2,
    });
    expect((await request('GET', '/me/projects', headers.anon)).status).toBe(401);

    const userPath = `/user/${orgOwnerUser.id}/projects`;
    expect(await listIds(userPath, headers.anon)).toEqual({ ids: [userPub], total: 1 });
    expect(await listIds(userPath, headers.outsider)).toEqual({ ids: [userPub], total: 1 });
    expect(await listIds(userPath, headers.orgAdmin)).toEqual({ ids: [userPub], total: 1 });
    expect(await listIds(userPath, headers.orgOwner)).toEqual({ ids: userAll, total: 2 });
    expect(await listIds(userPath, headers.ownerViewerToken)).toEqual({ ids: userAll, total: 2 });
    expect(await listIds(userPath, headers.superadmin)).toEqual({ ids: userAll, total: 2 });
    expect(await listIds(`${userPath}?searchFields[readAccess]=private`, headers.outsider)).toEqual(
      {
        ids: [],
        total: 0,
      },
    );
    expect(await listIds(userPath, bearer(entitlementOnlyUserToken.rawKey))).toEqual({
      ids: userAll,
      total: 2,
    });
    expect(await listIds(`/user/${orgMemberUser.id}/projects`, headers.orgMember)).toEqual({
      ids: [],
      total: 0,
    });

    const { entity: deletedUser } = await createUser();
    await db.user.update({ where: { id: deletedUser.id }, data: { deletedAt: new Date() } });
    expect((await request('GET', `/user/${deletedUser.id}/projects`, headers.anon)).status).toBe(
      404,
    );

    const { entity: deletedOrg } = await createOrganization();
    await db.organization.update({ where: { id: deletedOrg.id }, data: { deletedAt: new Date() } });
    expect(
      (await request('GET', `/organization/${deletedOrg.id}/projects`, headers.anon)).status,
    ).toBe(404);

    const { entity: deletedSpace } = await createSpace({}, { organization });
    await db.space.update({ where: { id: deletedSpace.id }, data: { deletedAt: new Date() } });
    expect((await request('GET', `/space/${deletedSpace.id}/projects`, headers.anon)).status).toBe(
      404,
    );

    const { entity: deletedOrgUser } = await createOrganizationUser(
      { role: Role.member },
      { organization },
    );
    await db.organizationUser.update({
      where: { id: deletedOrgUser.id },
      data: { deletedAt: new Date() },
    });
    expect(
      (await request('GET', `/organizationUser/${deletedOrgUser.id}/projects`, headers.anon))
        .status,
    ).toBe(404);

    const { entity: deletedSpaceUser, context: dsuCtx } = await createOrganizationUser(
      { role: Role.member },
      { organization },
    );
    const { entity: deletedSpSeat } = await createSpaceUser(
      { role: Role.member },
      { organization, space, user: dsuCtx.user, organizationUser: deletedSpaceUser },
    );
    await db.spaceUser.update({
      where: { id: deletedSpSeat.id },
      data: { deletedAt: new Date() },
    });
    expect(
      (await request('GET', `/spaceUser/${deletedSpSeat.id}/projects`, headers.anon)).status,
    ).toBe(404);
  });
});
