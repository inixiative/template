import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createUser } from '@template/db/test';
import { app } from '#/app';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

afterAll(async () => {
  await cleanupTouchedTables(db);
});

const request = (path: string, headers: Record<string, string> = {}, init: RequestInit = {}) =>
  app.request(`/api/v1${path}`, { ...init, headers: { ...headers, ...init.headers } });

const bearer = async (ownerModel: 'User' | 'OrganizationUser', owners: Record<string, unknown>) => {
  const { rawKey } = await createKeyedToken({ ownerModel, role: 'owner' }, owners);
  return { authorization: `Bearer ${rawKey}` };
};

const memberToken = async () => {
  const { entity: organizationUser } = await createOrganizationUser({ role: 'owner' });
  return bearer('OrganizationUser', { organizationUser });
};

describe('/me is the user behind the request: a user or a User token, nobody else', () => {
  it('a signed-in user reads /me as themselves', async () => {
    const { entity: user } = await createUser();
    const { authorization } = await createUserJwt(user);
    const response = await request('/me', { authorization });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: { id: string } }).data.id).toBe(user.id);
  });

  it('a User token reads /me as its user', async () => {
    const { entity: user } = await createUser();
    const { authorization } = await bearer('User', { user });
    const response = await request('/me', { authorization });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: { id: string } }).data.id).toBe(user.id);
    expect((await request('/me/tokens', { authorization })).status).toBe(200);
  });

  it('a member token has no me: 401 on every /me route', async () => {
    const headers = await memberToken();
    expect((await request('/me', headers)).status).toBe(401);
    expect((await request('/me/tokens', headers)).status).toBe(401);
  });

  it('anonymous: 401 on every /me route, before the body is read', async () => {
    expect((await request('/me')).status).toBe(401);
    expect((await request('/me/organizations')).status).toBe(401);
    expect(
      (
        await request(
          '/me/tokens',
          {},
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ unexpected: true }),
          },
        )
      ).status,
    ).toBe(401);
  });

  it('a member token off /me is not turned away for having no me', async () => {
    const headers = await memberToken();
    expect((await request('/identify', headers)).status).toBe(200);
  });
});
