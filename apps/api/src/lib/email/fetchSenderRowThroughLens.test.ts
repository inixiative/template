import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { fetchSenderRowThroughLens } from '#/lib/email/fetchSenderRowThroughLens';

describe('fetchSenderRowThroughLens', () => {
  beforeEach(() => {});

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('is the sending organization, its columns only', async () => {
    const { entity: organization } = await createOrganization({ name: 'Acme' });
    const sender = await fetchSenderRowThroughLens({
      type: 'Organization',
      organizationId: organization.id,
    });
    expect(sender?.id).toBe(organization.id);
    expect(sender?.name).toBe('Acme');
    expect(
      Object.values(sender ?? {}).some(
        (value) => typeof value === 'object' && value !== null && !(value instanceof Date),
      ),
    ).toBe(false);
  });

  it('is the sending member, found by its user and organization', async () => {
    const { entity: organizationUser } = await createOrganizationUser();
    const sender = await fetchSenderRowThroughLens({
      type: 'OrganizationUser',
      userId: organizationUser.userId,
      organizationId: organizationUser.organizationId,
    });
    expect(sender?.id).toBe(organizationUser.id);
  });

  it('is absent for the platform and admin, which no lens describes', async () => {
    expect(await fetchSenderRowThroughLens({ type: 'platform' })).toBeUndefined();
    expect(await fetchSenderRowThroughLens({ type: 'admin' })).toBeUndefined();
  });
});
