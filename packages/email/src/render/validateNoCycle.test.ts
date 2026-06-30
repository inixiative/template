import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createEmailComponent } from '@template/db/test';
import { EmailRenderError } from '@template/email/render/errors';
import type { OwnerScope } from '@template/email/render/types';
import { validateNoCycle } from '@template/email/render/validateNoCycle';

const ctx: OwnerScope = { ownerModel: 'default', locale: 'en' };

describe('validateNoCycle', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  beforeEach(async () => {
    await db.emailComponent.deleteMany({});
    await db.emailTemplate.deleteMany({});
  });

  it('catches direct self-reference (A → A)', async () => {
    const err = await validateNoCycle('a', ['a'], ctx).catch((e) => e);
    expect(err).toBeInstanceOf(EmailRenderError);
    expect((err as EmailRenderError).type).toBe('circular_ref');
    expect((err as EmailRenderError).path).toEqual(['a', 'a']);
  });

  it('catches 2-cycle when closing edge is saved (A → B when B → A exists)', async () => {
    await createEmailComponent({ slug: 'b', componentRefs: ['a'] });

    const err = await validateNoCycle('a', ['b'], ctx).catch((e) => e);
    expect(err).toBeInstanceOf(EmailRenderError);
    expect((err as EmailRenderError).type).toBe('circular_ref');
    expect((err as EmailRenderError).path).toEqual(['a', 'b', 'a']);
  });

  it('catches 3-cycle and reports the full path (A → B → C → A)', async () => {
    await createEmailComponent({ slug: 'b', componentRefs: ['c'] });
    await createEmailComponent({ slug: 'c', componentRefs: ['a'] });

    const err = await validateNoCycle('a', ['b'], ctx).catch((e) => e);
    expect(err).toBeInstanceOf(EmailRenderError);
    expect((err as EmailRenderError).path).toEqual(['a', 'b', 'c', 'a']);
  });

  // The visited-set must dedupe by slug across paths; without it, this DAG
  // would re-walk D's subtree once per parent, and a buggier variant could
  // even flag D as a false positive on the second visit.
  it('does not flag a DAG with a shared subtree (A → [B, C], B → D, C → D)', async () => {
    await createEmailComponent({ slug: 'b', componentRefs: ['d'] });
    await createEmailComponent({ slug: 'c', componentRefs: ['d'] });
    await createEmailComponent({ slug: 'd', componentRefs: [] });

    await expect(validateNoCycle('a', ['b', 'c'], ctx)).resolves.toBeUndefined();
  });

  it('does not flag a linear chain (A → B → C → D)', async () => {
    await createEmailComponent({ slug: 'b', componentRefs: ['c'] });
    await createEmailComponent({ slug: 'd', componentRefs: [] });
    await createEmailComponent({ slug: 'c', componentRefs: ['d'] });

    await expect(validateNoCycle('a', ['b'], ctx)).resolves.toBeUndefined();
  });
});
