import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db/client';
import { cleanupTouchedTables } from '@template/db/test';
import {
  createInquiry,
  createIntegration,
  createTag,
  createUser,
} from '@template/db/test/factories';
import { createFactory } from '@template/db/test/factory';

describe('polymorphic factories', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('refuses a factory that defaults its discriminator', () => {
    expect(() =>
      createFactory('Integration', { defaults: () => ({ ownerModel: 'User' as const }) }),
    ).toThrow('defaults its discriminator ownerModel');
  });

  it('requires the caller to choose a required discriminator', async () => {
    await expect(createIntegration()).rejects.toThrow('ownerModel is required — pass it');
  });

  it('requires the foreign keys the chosen discriminator selects', async () => {
    await expect(createIntegration({ ownerModel: 'User' })).rejects.toThrow(
      'Integration ownerModel=User needs userId',
    );
  });

  it('builds the row once the owner is passed', async () => {
    const { entity: user } = await createUser();
    const { entity } = await createIntegration({ ownerModel: 'User' }, { user });
    expect(entity.userId).toBe(user.id);
  });

  it('accepts a discriminator value that selects no foreign keys', async () => {
    const { entity: user } = await createUser();
    const { entity } = await createInquiry({ sourceModel: 'admin', targetModel: 'User' }, { user });
    expect(entity.targetUserId).toBe(user.id);
  });

  it('a defaulted discriminator builds its parent chain on its own', async () => {
    const { entity, context } = await createTag();
    expect(entity.ownerModel).toBe('platform');
    expect(context.tagCategory?.ownerModel).toBe('platform');
  });
});
