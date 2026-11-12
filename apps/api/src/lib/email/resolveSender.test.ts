import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { resolveSender } from '#/lib/email/resolveSender';

describe('resolveSender', () => {
  beforeEach(() => {});

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('is the sending organization, its columns only', async () => {
    const { entity: organization } = await createOrganization({ name: 'Acme' });
    const sender = await resolveSender({ type: 'Organization', organizationId: organization.id });
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
    const sender = await resolveSender({
      type: 'OrganizationUser',
      userId: organizationUser.userId,
      organizationId: organizationUser.organizationId,
    });
    expect(sender?.id).toBe(organizationUser.id);
  });

  it('is absent for the platform and admin, which no lens describes', async () => {
    expect(await resolveSender({ type: 'platform' })).toBeUndefined();
    expect(await resolveSender({ type: 'admin' })).toBeUndefined();
  });
});
