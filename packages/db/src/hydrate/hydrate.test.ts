import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSession,
  createToken,
  createUser,
  registerTestTracker,
} from '../test';
import { fetchOne } from './fetchOne';
import { hydrate } from './hydrate';

describe('hydrate', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('hydrates single relation', async () => {
    const { entity: token, context } = await createToken({ organizationUser: {} });

    const result = await hydrate(db, 'token', {
      id: token.id,
      userId: token.userId,
      organizationId: token.organizationId,
    });

    expect(result.user).toBeDefined();
    expect((result.user as { id: string }).id).toBe(context.user!.id);
    expect(result.organization).toBeDefined();
    expect((result.organization as { id: string }).id).toBe(context.organization!.id);
  });

  it('hydrates nested relations - token -> orgUser -> org', async () => {
    const { entity: token, context } = await createToken({ organizationUser: {} });

    const result = await hydrate(db, 'token', {
      id: token.id,
      userId: token.userId,
      organizationId: token.organizationId,
    });

    // Token -> OrganizationUser (composite FK)
    expect(result.organizationUser).toBeDefined();
    const hydratedOrgUser = result.organizationUser as { organization: { id: string } };
    expect(hydratedOrgUser.organization).toBeDefined();
    expect(hydratedOrgUser.organization.id).toBe(context.organization!.id);
  });

  it('deduplicates fetches for same record', async () => {
    const { entity: token } = await createToken({ organizationUser: {} });

    const pending = new Map();
    await hydrate(
      db,
      'token',
      {
        id: token.id,
        userId: token.userId,
        organizationId: token.organizationId,
      },
      pending,
    );

    // Organization accessed via token.organizationId - should only be in pending once
    // Cache key format: cache:organization:id:<value>
    const orgKeys = [...pending.keys()].filter((k) => k.includes(':organization:'));
    expect(orgKeys.length).toBe(1);
  });

  it('handles null FK gracefully', async () => {
    const { entity: user } = await createUser();

    const result = await hydrate(db, 'user', { id: user.id });

    expect(result.id).toBe(user.id);
  });

  it('handles missing related record gracefully', async () => {
    const { entity: session, context } = await createSession();

    // Delete user to create orphan
    await db.user.delete({ where: { id: context.user!.id } });

    const result = await hydrate(db, 'session', { id: session.id, userId: session.userId });
    expect(result.user).toBeUndefined();
  });
});

describe('fetchOne', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('fetches by simple id', async () => {
    const { entity: user } = await createUser();

    const result = await fetchOne(db, 'user', user.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(user.id);
  });

  it('fetches by composite key', async () => {
    const { entity: orgUser } = await createOrganizationUser();

    const result = await fetchOne(db, 'organizationUser', {
      organizationId: orgUser.organizationId,
      userId: orgUser.userId,
    });

    expect(result).toBeDefined();
    expect(result?.organizationId).toBe(orgUser.organizationId);
    expect(result?.userId).toBe(orgUser.userId);
  });

  it('returns null for missing record', async () => {
    const result = await fetchOne(db, 'user', 'nonexistent-id');
    expect(result).toBeNull();
  });
});
