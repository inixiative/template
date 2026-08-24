import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createEmailComponent } from '@template/db/test';
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { OwnerScope } from '@template/email/render/types';

const defaultScope: OwnerScope = { ownerModel: 'default', locale: 'en' };
// A slug that matches the slug regex but collides with Object.prototype.
const protoSlug = 'constructor';

describe('lookupCascade — prototype-pollution guard', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  beforeEach(async () => {
    await db.emailComponent.deleteMany({});
  });

  it('does not resolve a phantom component for a prototype-key slug when none exists', async () => {
    const merged = await lookupCascade([protoSlug], defaultScope);
    expect(merged[protoSlug]).toBeUndefined();
  });

  it('resolves a real component whose slug collides with a prototype key', async () => {
    await createEmailComponent({ slug: protoSlug, ownerModel: 'default', locale: 'en' });
    const merged = await lookupCascade([protoSlug], defaultScope);
    expect(merged[protoSlug]?.slug).toBe(protoSlug);
  });
});
