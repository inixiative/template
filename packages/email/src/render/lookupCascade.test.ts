import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createEmailComponent } from '@template/db/test';
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { OwnerScope } from '@template/email/render/types';

const defaultCtx: OwnerScope = { ownerModel: 'default', locale: 'en' };

describe('lookupCascade', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  beforeEach(async () => {
    await db.emailComponent.deleteMany({});
  });

  it('resolves a present slug to its component', async () => {
    await createEmailComponent({ slug: 'header', mjml: '<mj-text>H</mj-text>', ownerModel: 'default' });
    const result = await lookupCascade(['header'], defaultCtx);
    expect(result.header?.mjml).toBe('<mj-text>H</mj-text>');
  });

  it('resolves an absent slug named like an Object prototype key to undefined', async () => {
    const protoSlugs = ['constructor', '__proto__', 'toString'];
    const result = await lookupCascade(protoSlugs, defaultCtx);
    for (const slug of protoSlugs) expect(result[slug]).toBeUndefined();
  });
});
