import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, Role, Token } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createToken,
} from '@template/db/test';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { entitlementInputFor } from '#tests/utils/entitlementInputFor';
import { del } from '#tests/utils/request';

let organization: Organization;
let token: Token;

const as = async (role: Role) => {
  const { entity: member, context } = await createOrganizationUser({ role }, { organization });
  return createTestApp({
    mockUser: context.user,
    mockOrganizationUsers: [member],
    mount: [(hono) => hono.route('/api/v1/token', tokenRouter)],
  });
};

const rowIds = async () =>
  (await db.entitlement.findMany({ where: { targetModel: 'Token', targetTokenId: token.id } })).map(
    ({ id }) => id,
  );

beforeEach(async () => {
  ({ entity: organization } = await createOrganization());
  ({ entity: token } = await createToken({
    ownerModel: 'Organization',
    organizationId: organization.id,
    role: null,
    entitlements: [
      entitlementInputFor('db:Organization', ['db:Organization', organization.id], ['manage']),
    ],
  }));
});

afterEach(async () => {
  await cleanupTouchedTables(db);
});

describe("removing a token's entitlement takes administering the token (Aron, 2026-11-16)", () => {
  for (const role of ['viewer', 'member'] as const)
    it(`a ${role} of the organization, who could mint such a token, does not remove its rows`, async () => {
      const ids = await rowIds();
      const response = await (await as(role)).fetch(
        del(`/api/v1/token/${token.id}/entitlements`, undefined, ids),
      );
      expect(response.status).toBe(403);
      expect(await rowIds()).toEqual(ids);
    });

  it('an admin removes a row it could not have granted', async () => {
    const response = await (await as('admin')).fetch(
      del(`/api/v1/token/${token.id}/entitlements`, undefined, await rowIds()),
    );
    expect(response.status).toBe(204);
    expect(await rowIds()).toEqual([]);
  });
});
