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
import { PlatformRole, ProjectAccess, Role } from '@template/db/generated/client/enums';
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

describe('Project visibility (public | tenant | private)', () => {
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

  it('defaults access to private on create, accepts explicit access, and requires manage to update access', async () => {
    const createdDefault = await request(
      'POST',
      `/organization/${organization.id}/projects`,
      headers.orgAdmin,
      { name: 'Default Private' },
    );
    expect(createdDefault.status).toBe(201);
    const { data: project } = (await createdDefault.json()) as { data: Project };
    expect(project.access).toBe(ProjectAccess.private);

    const createdTenant = await request(
      'POST',
      `/organization/${organization.id}/projects`,
      headers.orgAdmin,
      { name: 'Explicit Tenant', access: ProjectAccess.tenant },
    );
    expect(createdTenant.status).toBe(201);
    expect(((await createdTenant.json()) as { data: Project }).data.access).toBe(
      ProjectAccess.tenant,
    );

    expect(
      (
        await request('PATCH', `/project/${project.id}`, headers.orgMember, {
          access: ProjectAccess.public,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request('PATCH', `/project/${project.id}`, headers.anon, {
          access: ProjectAccess.public,
        })
      ).status,
    ).toBe(403);

    const updated = await request('PATCH', `/project/${project.id}`, headers.orgAdmin, {
      access: ProjectAccess.public,
    });
    expect(updated.status).toBe(200);
    expect(((await updated.json()) as { data: Project }).data.access).toBe(ProjectAccess.public);
  });

  it('GET /project/:id enforces visibility across Organization, Space, OrganizationUser, SpaceUser, and User projects', async () => {
    const makeThree = async (
      fields: Partial<Pick<Project, 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>>,
    ) => {
      const priv = (await createProject({ ...fields, access: ProjectAccess.private })).entity;
      const tenant = (await createProject({ ...fields, access: ProjectAccess.tenant })).entity;
      const pub = (await createProject({ ...fields, access: ProjectAccess.public })).entity;
      return { priv, tenant, pub };
    };

    const orgProjects = await makeThree({
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
      (await request('GET', `/project/${orgProjects.tenant.id}`, headers.orgViewer)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${orgProjects.tenant.id}`, headers.outsider)).status,
    ).toBe(403);
    expect((await request('GET', `/project/${orgProjects.tenant.id}`, headers.anon)).status).toBe(
      403,
    );
    expect(
      (await request('DELETE', `/project/${orgProjects.tenant.id}`, headers.orgMember)).status,
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

    const spaceProjects = await makeThree({
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
      (await request('GET', `/project/${spaceProjects.tenant.id}`, headers.spaceViewer)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${spaceProjects.tenant.id}`, headers.orgAdmin)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceProjects.tenant.id}`, headers.orgViewer)).status,
    ).toBe(403);
    expect((await request('GET', `/project/${spaceProjects.pub.id}`, headers.anon)).status).toBe(
      200,
    );

    const otherSpaceTenant = (
      await createProject({
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: otherSpace.id,
        access: ProjectAccess.tenant,
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

    const memberProjects = await makeThree({
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
      (await request('GET', `/project/${memberProjects.tenant.id}`, headers.orgViewer)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${memberProjects.tenant.id}`, headers.orgAdmin)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${memberProjects.tenant.id}`, headers.outsider)).status,
    ).toBe(403);
    expect(
      (
        await request('PATCH', `/project/${memberProjects.tenant.id}`, headers.orgAdmin, {
          name: 'x',
        })
      ).status,
    ).toBe(403);
    expect(
      (await request('DELETE', `/project/${memberProjects.tenant.id}`, headers.orgAdmin)).status,
    ).toBe(403);
    expect(
      (await request('DELETE', `/project/${memberProjects.pub.id}`, headers.orgAdmin)).status,
    ).toBe(403);
    expect((await request('GET', `/project/${memberProjects.pub.id}`, headers.anon)).status).toBe(
      200,
    );

    const spaceMemberProjects = await makeThree({
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
      (await request('GET', `/project/${spaceMemberProjects.tenant.id}`, headers.spaceViewer))
        .status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.tenant.id}`, headers.orgAdmin)).status,
    ).toBe(403);
    expect(
      (
        await request('PATCH', `/project/${spaceMemberProjects.tenant.id}`, headers.spaceAdmin, {
          name: 'x',
        })
      ).status,
    ).toBe(403);
    expect(
      (await request('DELETE', `/project/${spaceMemberProjects.tenant.id}`, headers.spaceAdmin))
        .status,
    ).toBe(403);
    expect(
      (await request('DELETE', `/project/${spaceMemberProjects.pub.id}`, headers.spaceAdmin))
        .status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${spaceMemberProjects.pub.id}`, headers.anon)).status,
    ).toBe(200);

    const userProjects = await makeThree({
      ownerModel: 'User',
      userId: orgOwnerUser.id,
    });
    expect(
      (await request('GET', `/project/${userProjects.priv.id}`, headers.ownerViewerToken)).status,
    ).toBe(200);
    expect(
      (await request('GET', `/project/${userProjects.tenant.id}`, headers.outsider)).status,
    ).toBe(403);
    expect(
      (await request('GET', `/project/${userProjects.tenant.id}`, headers.orgAdmin)).status,
    ).toBe(403);
    expect((await request('GET', `/project/${userProjects.pub.id}`, headers.anon)).status).toBe(
      200,
    );
  });

  it('explicit entitlements on db:Project open private projects on single-record read and owner lists, without leaking unmatched where clauses', async () => {
    const { entity: grantedPriv } = await createProject({
      name: 'Allowed Private',
      ownerModel: 'Organization',
      organizationId: organization.id,
      access: ProjectAccess.private,
    });
    const { entity: otherPriv } = await createProject({
      name: 'Hidden Private',
      ownerModel: 'Organization',
      organizationId: organization.id,
      access: ProjectAccess.private,
    });
    const { entity: mismatchedPriv } = await createProject({
      name: 'Renamed Later',
      ownerModel: 'Organization',
      organizationId: organization.id,
      access: ProjectAccess.private,
    });
    const { entity: pub } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
      access: ProjectAccess.public,
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
        `/organization/${organization.id}/projects?searchFields[access]=private`,
        grantedHeaders,
      ),
    ).toEqual({
      ids: [grantedPriv.id],
      total: 1,
    });
  });

  it('refuses laundering transient tenant/public visibility into permanent self-anchored entitlements while permitting legitimate owner/admin grants', async () => {
    const { entity: memberTenant } = await createProject({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: orgMemberUser.id,
      access: ProjectAccess.tenant,
    });
    const { entity: spacePublic } = await createProject({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
      access: ProjectAccess.public,
    });
    const { entity: spaceMemberTenant } = await createProject({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceMemberUser.id,
      access: ProjectAccess.tenant,
    });
    const { entity: orgPrivate } = await createProject({
      ownerModel: 'Organization',
      organizationId: organization.id,
      access: ProjectAccess.private,
    });
    const { entity: orgIntegration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { entity: memberLink } = await createProjectIntegration(
      {},
      { project: memberTenant, integration: orgIntegration },
    );

    expect(
      (
        await request(
          'POST',
          `/organizationUser/${orgAdminSeat.id}/entitlements`,
          headers.orgAdmin,
          [entitlementInputFor('db:Project', ['db:Project', memberTenant.id], ['read'])],
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
          entitlementInputFor('db:Project', ['db:Project', spaceMemberTenant.id], ['read']),
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
              ['db:Project', memberTenant.id, 'project'],
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
          [entitlementInputFor('db:Project', ['db:Project', memberTenant.id], ['read'])],
        )
      ).status,
    ).toBe(201);
  });

  it('reflects visibility in SQL across org, space, organizationUser, spaceUser, and me list routes and resists bracket filter bypasses', async () => {
    const createTriplet = async (
      fields: Partial<Pick<Project, 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>>,
    ) => {
      const priv = (await createProject({ ...fields, access: ProjectAccess.private })).entity.id;
      const tenant = (await createProject({ ...fields, access: ProjectAccess.tenant })).entity.id;
      const pub = (await createProject({ ...fields, access: ProjectAccess.public })).entity.id;
      return {
        priv,
        pubOnly: [pub],
        tenantAndPub: [tenant, pub].sort(),
        all: [priv, tenant, pub].sort(),
      };
    };

    const orgSet = await createTriplet({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const orgPath = `/organization/${organization.id}/projects`;
    expect(await listIds(orgPath, headers.anon)).toEqual({ ids: orgSet.pubOnly, total: 1 });
    expect(await listIds(orgPath, headers.outsider)).toEqual({ ids: orgSet.pubOnly, total: 1 });
    expect(await listIds(orgPath, headers.foreignToken)).toEqual({ ids: orgSet.pubOnly, total: 1 });
    expect(await listIds(orgPath, headers.orgViewer)).toEqual({
      ids: orgSet.tenantAndPub,
      total: 2,
    });
    expect(await listIds(orgPath, headers.orgMember)).toEqual({
      ids: orgSet.tenantAndPub,
      total: 2,
    });
    expect(await listIds(orgPath, headers.orgAdmin)).toEqual({ ids: orgSet.all, total: 3 });
    expect(await listIds(orgPath, headers.superadmin)).toEqual({ ids: orgSet.all, total: 3 });

    expect(await listIds(`${orgPath}?searchFields[access]=private`, headers.outsider)).toEqual({
      ids: [],
      total: 0,
    });
    expect(
      await listIds(
        `${orgPath}?searchFields[OR][0][access]=private&searchFields[OR][1][access]=tenant`,
        headers.outsider,
      ),
    ).toEqual({ ids: [], total: 0 });
    expect(await listIds(`${orgPath}?searchFields[access]=private`, headers.orgMember)).toEqual({
      ids: [],
      total: 0,
    });
    expect(await listIds(`${orgPath}?searchFields[access]=private`, headers.orgAdmin)).toEqual({
      ids: [orgSet.priv],
      total: 1,
    });

    const spaceSet = await createTriplet({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });
    const spacePath = `/space/${space.id}/projects`;
    expect(await listIds(spacePath, headers.anon)).toEqual({ ids: spaceSet.pubOnly, total: 1 });
    expect(await listIds(spacePath, headers.orgAdmin)).toEqual({ ids: spaceSet.pubOnly, total: 1 });
    expect(await listIds(spacePath, headers.spaceViewer)).toEqual({
      ids: spaceSet.tenantAndPub,
      total: 2,
    });
    expect(await listIds(spacePath, headers.spaceMember)).toEqual({
      ids: spaceSet.tenantAndPub,
      total: 2,
    });
    expect(await listIds(spacePath, headers.spaceAdmin)).toEqual({ ids: spaceSet.all, total: 3 });
    expect(await listIds(spacePath, headers.orgOwner)).toEqual({ ids: spaceSet.all, total: 3 });

    const otherSpaceSet = await createTriplet({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: otherSpace.id,
    });
    expect(await listIds(`/space/${otherSpace.id}/projects`, headers.spaceAdmin)).toEqual({
      ids: otherSpaceSet.pubOnly,
      total: 1,
    });

    const orgUserSet = await createTriplet({
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
      ids: orgUserSet.tenantAndPub,
      total: 2,
    });
    expect(await listIds(orgUserPath, headers.orgAdmin)).toEqual({
      ids: orgUserSet.tenantAndPub,
      total: 2,
    });
    expect(await listIds(orgUserPath, headers.orgMember)).toEqual({
      ids: orgUserSet.all,
      total: 3,
    });
    expect(await listIds(orgUserPath, headers.orgOwner)).toEqual({
      ids: orgUserSet.all,
      total: 3,
    });
    expect(await listIds(`${orgUserPath}?searchFields[access]=private`, headers.orgAdmin)).toEqual({
      ids: [],
      total: 0,
    });

    const spaceUserSet = await createTriplet({
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
      ids: spaceUserSet.tenantAndPub,
      total: 2,
    });
    expect(await listIds(spaceUserPath, headers.spaceAdmin)).toEqual({
      ids: spaceUserSet.tenantAndPub,
      total: 2,
    });
    expect(await listIds(spaceUserPath, headers.spaceMember)).toEqual({
      ids: spaceUserSet.all,
      total: 3,
    });
    expect(await listIds(spaceUserPath, headers.spaceOwner)).toEqual({
      ids: spaceUserSet.all,
      total: 3,
    });
    expect(await listIds(spaceUserPath, headers.orgOwner)).toEqual({
      ids: spaceUserSet.all,
      total: 3,
    });

    const userSet = await createTriplet({
      ownerModel: 'User',
      userId: orgOwnerUser.id,
    });
    expect(await listIds('/me/projects', headers.orgOwner)).toEqual({ ids: userSet.all, total: 3 });
    expect(await listIds('/me/projects', headers.ownerViewerToken)).toEqual({
      ids: userSet.all,
      total: 3,
    });
    const entitlementOnlyUserToken = await createKeyedToken(
      {
        ownerModel: 'User',
        role: null,
        entitlements: [entitlementInputFor('db:Project', ['db:Project', userSet.priv], ['read'])],
      },
      { user: orgOwnerUser },
    );
    expect(await listIds('/me/projects', bearer(entitlementOnlyUserToken.rawKey))).toEqual({
      ids: [userSet.priv, ...userSet.pubOnly].sort(),
      total: 2,
    });
    expect((await request('GET', '/me/projects', headers.anon)).status).toBe(401);

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
