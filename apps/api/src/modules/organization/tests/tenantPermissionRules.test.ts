import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Organization, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createContact,
  createOrganizationUser,
  createProject,
  createSpace,
  createUser,
  nextFactorySequenceNumber,
} from '@template/db/test';
import { contactRouter } from '#/modules/contact';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { projectRouter } from '#/modules/project';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { del, get, post } from '#tests/utils/request';

type AppOptions = Omit<Parameters<typeof createTestApp>[0], 'mount'>;

const appFor = (options: AppOptions) =>
  createTestApp({
    ...options,
    mount: [
      (app) => app.route('/api/v1/contact', contactRouter),
      (app) => app.route('/api/v1/me', meRouter),
      (app) => app.route('/api/v1/organization', organizationRouter),
      (app) => app.route('/api/v1/project', projectRouter),
      (app) => app.route('/api/v1/space', spaceRouter),
    ],
  });

const website = () => ({
  type: 'website' as const,
  value: { url: `https://site${nextFactorySequenceNumber()}.example.com` },
});

describe('tenantPermissionRules', () => {
  let asOwner: ReturnType<typeof createTestApp>['fetch'];
  let asAdmin: ReturnType<typeof createTestApp>['fetch'];
  let asStranger: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let org: Organization;
  let owner: User;

  const open = (rules: unknown, fetch = asOwner) =>
    fetch(
      post(`/api/v1/organization/${org.id}/setTenantPermissionRules`, {
        tenantPermissionRules: rules,
      }),
    );

  beforeEach(async () => {
    const ownerRow = await createOrganizationUser({ role: 'owner' });
    org = ownerRow.context.organization;
    owner = ownerRow.context.user;
    const adminRow = await createOrganizationUser({ role: 'admin' }, { organization: org });
    const { entity: stranger } = await createUser();

    const ownerApp = appFor({ mockUser: owner, mockOrganizationUsers: [ownerRow.entity] });
    asOwner = ownerApp.fetch;
    db = ownerApp.db;
    asAdmin = appFor({
      mockUser: adminRow.context.user,
      mockOrganizationUsers: [adminRow.entity],
    }).fetch;
    asStranger = appFor({ mockUser: stranger }).fetch;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('opens an action on every record of a model under the organization, and nothing else', async () => {
    const { entity: contact } = await createContact({
      organizationId: org.id,
      ownerModel: 'Organization',
      ...website(),
    });
    expect((await asStranger(get(`/api/v1/contact/${contact.id}`))).status).toBe(403);

    expect((await open({ 'db:contact': { read: true } })).status).toBe(200);

    expect((await asStranger(get(`/api/v1/contact/${contact.id}`))).status).toBe(200);
    expect((await asStranger(get(`/api/v1/organization/${org.id}/contacts`))).status).toBe(200);
    expect((await asStranger(del(`/api/v1/contact/${contact.id}`))).status).toBe(403);

    expect((await open(null)).status).toBe(200);
    expect((await asStranger(get(`/api/v1/contact/${contact.id}`))).status).toBe(403);
  });

  it("leaves another organization's records closed", async () => {
    const other = await createOrganizationUser({ role: 'owner' });
    const { entity: contact } = await createContact({
      organizationId: other.context.organization.id,
      ownerModel: 'Organization',
      ...website(),
    });
    await open({ 'db:contact': { read: true } });
    expect((await asStranger(get(`/api/v1/contact/${contact.id}`))).status).toBe(403);
  });

  it("reaches the records of the organization's spaces", async () => {
    const { entity: space } = await createSpace({}, { organization: org });
    const { entity: contact } = await createContact({
      spaceId: space.id,
      ownerModel: 'Space',
      ...website(),
    });
    expect((await asStranger(get(`/api/v1/contact/${contact.id}`))).status).toBe(403);
    await open({ 'db:contact': { read: true } });
    expect((await asStranger(get(`/api/v1/contact/${contact.id}`))).status).toBe(200);
  });

  it('takes a condition on the record', async () => {
    const make = (label: string) =>
      createContact({ organizationId: org.id, ownerModel: 'Organization', label, ...website() });
    const { entity: shared } = await make('public');
    const { entity: kept } = await make('private');
    await open({
      'db:contact': { read: { rule: { field: 'label', operator: 'equals', value: 'public' } } },
    });
    expect((await asStranger(get(`/api/v1/contact/${shared.id}`))).status).toBe(200);
    expect((await asStranger(get(`/api/v1/contact/${kept.id}`))).status).toBe(403);
  });

  it('is written only by an owner', async () => {
    expect((await open({ 'db:contact': { read: true } }, asAdmin)).status).toBe(403);
    expect((await open({ 'db:contact': { read: true } }, asStranger)).status).toBe(403);
  });

  it('refuses a model, an action or a rule the schema does not accept', async () => {
    for (const rules of [
      { 'db:invoice': { read: true } },
      { 'db:contact': { publish: true } },
      { 'db:contact': { read: 'read' } },
      { 'db:contact': { read: { rule: { field: 'label', operator: 'notEquals', value: 'x' } } } },
    ])
      expect((await open(rules)).status).toBe(422);
  });

  it('works the same on a space and on a user', async () => {
    const { entity: space } = await createSpace({}, { organization: org });
    const { entity: inSpace } = await createContact({
      spaceId: space.id,
      ownerModel: 'Space',
      ...website(),
    });
    const { entity: mine } = await createContact({
      userId: owner.id,
      ownerModel: 'User',
      ...website(),
    });
    const rules = { tenantPermissionRules: { 'db:contact': { read: true } } };

    expect(
      (await asOwner(post(`/api/v1/space/${space.id}/setTenantPermissionRules`, rules))).status,
    ).toBe(200);
    expect((await asStranger(get(`/api/v1/contact/${inSpace.id}`))).status).toBe(200);

    expect((await asStranger(get(`/api/v1/contact/${mine.id}`))).status).toBe(403);
    expect((await asOwner(post('/api/v1/me/setTenantPermissionRules', rules))).status).toBe(200);
    expect((await asStranger(get(`/api/v1/contact/${mine.id}`))).status).toBe(200);
  });

  it("a user's rules open what the user owns, never what their membership holds", async () => {
    const { entity: mine } = await createProject({ ownerModel: 'User', userId: owner.id });
    const { entity: heldAsMember } = await createProject({
      ownerModel: 'OrganizationUser',
      organizationId: org.id,
      userId: owner.id,
    });
    const rules = { tenantPermissionRules: { 'db:project': { read: true } } };
    expect((await asOwner(post('/api/v1/me/setTenantPermissionRules', rules))).status).toBe(200);

    expect((await asStranger(get(`/api/v1/project/${mine.id}`))).status).toBe(200);
    expect((await asStranger(get(`/api/v1/project/${heldAsMember.id}`))).status).toBe(403);

    expect((await open({ 'db:project': { read: true } })).status).toBe(200);
    expect((await asStranger(get(`/api/v1/project/${heldAsMember.id}`))).status).toBe(200);
  });

  it('a condition on the record opens single records, not the list under the owner', async () => {
    await createContact({
      organizationId: org.id,
      ownerModel: 'Organization',
      label: 'public',
      ...website(),
    });
    await open({
      'db:contact': { read: { rule: { field: 'label', operator: 'equals', value: 'public' } } },
    });
    expect((await asStranger(get(`/api/v1/organization/${org.id}/contacts`))).status).toBe(403);
  });
});
