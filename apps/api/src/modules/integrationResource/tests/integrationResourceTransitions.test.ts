import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Integration, IntegrationResource, User } from '@template/db/generated/client/client';
import type { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createIntegrationResource,
  createUser,
} from '@template/db/test';
import { app } from '#/app';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

type Headers = Record<string, string>;

const json = { 'content-type': 'application/json' };
const asPerson = async (user: User): Promise<Headers> => ({
  ...json,
  authorization: (await createUserJwt(user)).authorization,
});
const asIntegration = async (integration: Integration): Promise<Headers> => {
  const { rawKey } = await createKeyedToken(
    { ownerModel: 'Integration', full: true },
    { integration },
  );
  return { ...json, authorization: `Bearer ${rawKey}` };
};

const setStatus = async (headers: Headers, id: string, status: IntegrationResourceStatus) =>
  (
    await app.request(`/api/v1/integrationResource/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    })
  ).status;

const register = (headers: Headers, integrationId: string, body: Record<string, unknown>) =>
  app.request(`/api/v1/integration/${integrationId}/integrationResources`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'General', kind: 'channel', externalId: 'C1', ...body }),
  });

const statusOf = async (id: string) =>
  (await db.withDeleted(() => db.integrationResource.findUniqueOrThrow({ where: { id } }))).status;

describe('integration resource status transitions', () => {
  let owner: User;
  let integration: Integration;
  let person: Headers;
  let itsIntegration: Headers;

  const resource = async (status: IntegrationResourceStatus = 'tracked', externalId = 'C1') =>
    (await createIntegrationResource({ status, externalId, kind: 'channel' }, { integration }))
      .entity as IntegrationResource;

  beforeEach(async () => {
    owner = (await createUser()).entity;
    integration = (await createIntegration({ ownerModel: 'User', userId: owner.id, full: true }))
      .entity;
    person = await asPerson(owner);
    itsIntegration = await asIntegration(integration);
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('a person tracks and untracks, but never sets or clears missing', async () => {
    const row = await resource();
    expect(await setStatus(person, row.id, 'missing')).toBe(403);
    expect(await setStatus(person, row.id, 'untracked')).toBe(200);
    expect(await setStatus(person, row.id, 'tracked')).toBe(200);

    const gone = await resource('missing', 'C2');
    expect(await setStatus(person, gone.id, 'tracked')).toBe(403);
    expect(await setStatus(person, gone.id, 'untracked')).toBe(200);
  });

  it('its own integration moves it to and from missing, and never touches untracked', async () => {
    const row = await resource();
    expect(await setStatus(itsIntegration, row.id, 'missing')).toBe(200);
    expect(await statusOf(row.id)).toBe('missing');
    expect(await setStatus(itsIntegration, row.id, 'tracked')).toBe(200);
    expect(await setStatus(itsIntegration, row.id, 'untracked')).toBe(403);

    const ignored = await resource('untracked', 'C2');
    expect(await setStatus(itsIntegration, ignored.id, 'tracked')).toBe(403);
    expect(await statusOf(ignored.id)).toBe('untracked');
  });

  it("another integration's token cannot report this one's resources missing", async () => {
    const { entity: other } = await createIntegration({
      ownerModel: 'User',
      userId: owner.id,
      full: true,
    });
    const row = await resource();
    expect(await setStatus(await asIntegration(other), row.id, 'missing')).toBe(403);
    expect(await statusOf(row.id)).toBe('tracked');
  });

  it('setting the status a resource already has is allowed', async () => {
    const row = await resource();
    expect(await setStatus(person, row.id, 'tracked')).toBe(200);
  });

  it('a removed untracked resource comes back only when a person registers it as tracked', async () => {
    const row = await resource('untracked');
    await db.integrationResource.update({ where: { id: row.id }, data: { deletedAt: new Date() } });

    expect((await register(person, integration.id, {})).status).toBe(409);
    expect((await register(itsIntegration, integration.id, { status: 'tracked' })).status).toBe(
      403,
    );

    const revived = await register(person, integration.id, { status: 'tracked' });
    expect(revived.status).toBe(201);
    expect(await db.integrationResource.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject(
      { deletedAt: null, status: 'tracked' },
    );
  });

  it('its own integration re-registers a removed tracked resource, and it comes back tracked', async () => {
    const row = await resource();
    await db.integrationResource.update({ where: { id: row.id }, data: { deletedAt: new Date() } });

    expect((await register(itsIntegration, integration.id, {})).status).toBe(201);
    expect(await db.integrationResource.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject(
      { deletedAt: null, status: 'tracked' },
    );
  });

  it('registering a live untracked resource keeps it untracked unless a person tracks it', async () => {
    const row = await resource('untracked');
    expect((await register(itsIntegration, integration.id, {})).status).toBe(201);
    expect(await statusOf(row.id)).toBe('untracked');
    expect((await register(itsIntegration, integration.id, { status: 'tracked' })).status).toBe(
      403,
    );
    expect((await register(person, integration.id, { status: 'tracked' })).status).toBe(201);
    expect(await statusOf(row.id)).toBe('tracked');
  });
});
