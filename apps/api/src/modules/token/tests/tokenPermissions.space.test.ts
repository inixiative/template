/**
 * @atlas
 * @kind test
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createSpace, createToken } from '@template/db/test';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { organizationRouter } from '#/modules/organization';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';

describe('Space token bearer authentication', () => {
  let space: Space;
  let sibling: Space;
  let unrelated: Space;
  const key = randomUUID();
  const { fetch } = createTestApp({
    mount: [
      (app) => app.use('*', tokenAuthMiddleware),
      (app) => app.route('/api/v1/space', spaceRouter),
      (app) => app.route('/api/v1/organization', organizationRouter),
    ],
  });
  const request = (path: string, method = 'GET') =>
    fetch(
      new Request(`http://test/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${key}` },
      }),
    );

  beforeAll(async () => {
    const created = await createSpace();
    space = created.entity;
    sibling = (await createSpace({}, { organization: created.context.organization })).entity;
    unrelated = (await createSpace()).entity;
    await createToken(
      {
        ownerModel: 'Space',
        role: 'viewer',
        keyHash: createHash('sha256').update(key).digest('hex'),
        userId: null,
      },
      { space },
    );
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('reads its space customers without a user identity', async () => {
    expect((await request(`/space/${space.id}/customers`)).status).toBe(200);
  });

  it('cannot read a sibling space or a space in another organization', async () => {
    expect((await request(`/space/${sibling.id}/customers`)).status).toBe(403);
    expect((await request(`/space/${unrelated.id}/customers`)).status).toBe(403);
  });

  it('cannot enter organization routes that require a user identity', async () => {
    expect((await request(`/organization/${space.organizationId}`)).status).toBe(401);
  });

  it('keeps the token role restriction on its own space', async () => {
    expect((await request(`/space/${space.id}`, 'DELETE')).status).toBe(403);
  });
});
