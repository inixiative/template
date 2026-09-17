import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { TokenOwnerModel } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createOrganization, createSpace, createToken, createUser } from '@template/db/test';
import {
  organizationIdentity,
  principalIdentity,
  spaceIdentity,
  userIdentity,
} from '#/middleware/rateLimit/identities';
import { createTestApp, type MountFn } from '#tests/createTestApp';

const echo: MountFn = (app) => {
  app.get('/who', (c) =>
    c.json({
      principal: principalIdentity(c),
      user: userIdentity(c),
      organization: organizationIdentity(c),
      space: spaceIdentity(c),
    }),
  );
};

const who = (fetch: (req: Request) => Promise<Response>) =>
  fetch(new Request('http://t/who', { headers: { 'x-forwarded-for': '203.0.113.7' } })).then((r) => r.json());

const bareRelations = { user: null, organization: null, organizationUser: null, space: null, spaceUser: null };

describe('rate limit identities', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('anonymous requests fall back to the client IP', async () => {
    const { fetch } = createTestApp({ mount: [echo] });
    expect(await who(fetch)).toEqual({ principal: 'ip:203.0.113.7', user: null, organization: null, space: null });
  });

  it('a session and a user-owned token share the user bucket', async () => {
    const { entity: user } = await createUser();
    const { entity: token } = await createToken({}, { user });

    const viaSession = await who(createTestApp({ mockUser: user, mount: [echo] }).fetch);
    const viaToken = await who(
      createTestApp({ mockUser: user, mockToken: { ...token, ...bareRelations, user }, mount: [echo] }).fetch,
    );

    expect(viaSession.principal).toBe(`user:${user.id}`);
    expect(viaToken.principal).toBe(`user:${user.id}`);
    expect(viaSession.organization).toBeNull();
  });

  it('an organization-owned token is the organization, with no user bucket', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: token } = await createToken({ ownerModel: TokenOwnerModel.Organization }, { organization });

    const result = await who(
      createTestApp({ mockToken: { ...token, ...bareRelations, organization }, mount: [echo] }).fetch,
    );

    expect(result).toEqual({
      principal: 'ip:203.0.113.7',
      user: null,
      organization: `organization:${organization.id}`,
      space: null,
    });
  });

  it('a space-owned token carries both the space and its organization', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const { entity: token } = await createToken({ ownerModel: TokenOwnerModel.Space }, { space });

    const result = await who(
      createTestApp({ mockToken: { ...token, ...bareRelations, organization, space }, mount: [echo] }).fetch,
    );

    expect(result.organization).toBe(`organization:${organization.id}`);
    expect(result.space).toBe(`space:${space.id}`);
  });
});
