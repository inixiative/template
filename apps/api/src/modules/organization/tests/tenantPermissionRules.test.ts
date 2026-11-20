import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Organization, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createContact,
  createOrganizationUser,
  createSpace,
  createUser,
  nextFactorySequenceNumber,
} from '@template/db/test';
import { contactRouter } from '#/modules/contact';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
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

  it("extends product records the tenant holds: never the permission system's own, never own", async () => {
    const { entity: space } = await createSpace({}, { organization: org });
    const refusedFor = (path: string) => async (rules: unknown) => {
      const response = await asOwner(post(path, { tenantPermissionRules: rules }));
      return response.status === 422 && (await response.text()).includes('may extend');
    };
    const organization = refusedFor(`/api/v1/organization/${org.id}/setTenantPermissionRules`);
    const atSpace = refusedFor(`/api/v1/space/${space.id}/setTenantPermissionRules`);
    const user = refusedFor('/api/v1/me/setTenantPermissionRules');

    for (const rules of [
      { 'db:token': { create: true } },
      { 'db:organizationUser': { operate: true } },
      { 'db:integration': { delegateFull: true } },
      { 'db:authProvider': { create: true } },
      { 'db:space': { manage: true } },
      { 'db:space': { own: true } },
      { 'db:project': { read: true } },
      { 'db:organization': { read: true } },
      { 'db:contact': { own: true } },
    ])
      expect(await organization(rules)).toBe(true);
    expect(await organization({ 'db:segment': { read: true } })).toBe(false);

    expect(await atSpace({ 'db:spaceUser': { operate: true } })).toBe(true);
    expect(await atSpace({ 'db:space': { read: true } })).toBe(true);
    expect(await user({ 'db:flow': { read: true } })).toBe(true);
    expect(await user({ 'db:contact': { read: true } })).toBe(false);
  });

  it('reads a stored rule through the lens too: one it hides widens nothing', async () => {
    const { entity: contact } = await createContact({
      organizationId: org.id,
      ownerModel: 'Organization',
      ...website(),
    });
    await db.organization.update({
      where: { id: org.id },
      data: { tenantPermissionRules: { 'db:contact': { own: true, read: true } } },
    });
    expect((await asStranger(get(`/api/v1/contact/${contact.id}`))).status).toBe(200);
    expect((await asStranger(del(`/api/v1/contact/${contact.id}`))).status).toBe(403);
  });

  it('opens its spaces to read or operate, never to minting their tokens', async () => {
    const { entity: space } = await createSpace({}, { organization: org });
    const members = () => asStranger(get(`/api/v1/space/${space.id}/spaceUsers`));
    const mint = (role: string | null) =>
      asStranger(post(`/api/v1/space/${space.id}/tokens`, { name: 'Token', role }));
    expect((await members()).status).toBe(403);

    const toOrganizationReaders = { rel: 'organization', action: 'read' };
    expect((await open({ 'db:space': { read: toOrganizationReaders } })).status).toBe(200);
    expect((await members()).status).toBe(403);

    expect((await open({ 'db:space': { operate: true } })).status).toBe(200);
    expect((await members()).status).toBe(200);
    for (const role of [null, 'viewer', 'member']) expect((await mint(role)).status).toBe(403);
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
