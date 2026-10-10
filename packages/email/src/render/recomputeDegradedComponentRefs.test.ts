/**
 * @atlas
 * @kind test
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { DbAction, db, HookTiming, registerDbHook, unregisterDbHook } from '@template/db';
import {
  cleanupTouchedTables,
  createEmailComponent,
  createEmailTemplate,
  registerTestTracker,
} from '@template/db/test';
import { recomputeDegradedComponentRefs } from '@template/email/render/recomputeDegradedComponentRefs';

registerTestTracker();

const cardBody = '{{#slot:inner:default}}{{#component:x}}{{/component:x}}{{/slot:inner:default}}';

describe('recomputeDegradedComponentRefs', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  afterEach(async () => {
    unregisterDbHook('move-email-version');
    await cleanupTouchedTables(db);
  });

  it('ignores a missing default-slot child only when the template overrides that slot', async () => {
    await createEmailComponent({ slug: 'card', mjml: cardBody });
    const { entity: overridden } = await createEmailTemplate({
      mjml: '{{#component:card}}{{#slot:inner}}OVERRIDE{{/slot:inner}}{{/component:card}}',
    });
    const { entity: inherited } = await createEmailTemplate({
      mjml: '{{#component:card}}{{/component:card}}',
    });
    expect(await recomputeDegradedComponentRefs('EmailTemplate', overridden.id)).toBe(false);
    expect(await recomputeDegradedComponentRefs('EmailTemplate', inherited.id)).toBe(true);
    expect(
      (await db.emailTemplate.findUniqueOrThrow({ where: { id: overridden.id } }))
        .degradedComponentRefs,
    ).toEqual([]);
    expect(
      (await db.emailTemplate.findUniqueOrThrow({ where: { id: inherited.id } }))
        .degradedComponentRefs,
    ).toEqual(['x']);
  });

  it('writes only on change and preserves the authored timestamp for both models', async () => {
    const { entity: template } = await createEmailTemplate({
      mjml: '{{#component:x}}{{/component:x}}',
    });
    const { entity: component } = await createEmailComponent({
      mjml: '{{#component:x}}{{/component:x}}',
    });
    for (const [model, row] of [
      ['EmailTemplate', template],
      ['EmailComponent', component],
    ] as const) {
      expect(await recomputeDegradedComponentRefs(model, row.id)).toBe(true);
      expect(await recomputeDegradedComponentRefs(model, row.id)).toBe(false);
      const stored =
        model === 'EmailTemplate'
          ? await db.emailTemplate.findUniqueOrThrow({ where: { id: row.id } })
          : await db.emailComponent.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored.degradedComponentRefs).toEqual(['x']);
      expect(stored.updatedAt).toEqual(row.updatedAt);
    }
  });

  it('does not overwrite a row whose authored timestamp moves after the read', async () => {
    const { entity: template } = await createEmailTemplate({
      mjml: '{{#component:x}}{{/component:x}}',
    });
    const movedAt = new Date(template.updatedAt.getTime() + 1000);
    let moved = false;
    registerDbHook(
      'move-email-version',
      'EmailTemplate',
      HookTiming.before,
      [DbAction.updateManyAndReturn],
      async () => {
        moved = true;
        await db.$executeRaw`UPDATE "EmailTemplate" SET "updatedAt" = ${movedAt}, "mjml" = ${'Authored content'} WHERE "id" = ${template.id}`;
      },
    );
    expect(await recomputeDegradedComponentRefs('EmailTemplate', template.id)).toBe(false);
    expect(moved).toBe(true);
    const stored = await db.emailTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(stored.updatedAt).toEqual(movedAt);
    expect(stored.mjml).toBe('Authored content');
    expect(stored.degradedComponentRefs).toEqual([]);
  });

  it('waits for a template lock when stored degradation is stale and recomputes both deletions', async () => {
    const { entity: a } = await createEmailComponent({ slug: 'a' });
    const { entity: b } = await createEmailComponent({ slug: 'b' });
    const { entity: template } = await createEmailTemplate({
      mjml: '{{#component:a}}{{/component:a}}{{#component:b}}{{/component:b}}',
    });
    await db.raw.emailComponent.update({
      where: { id: a.id },
      data: { deletedAt: new Date() },
    });
    expect(
      (await db.emailTemplate.findUniqueOrThrow({ where: { id: template.id } }))
        .degradedComponentRefs,
    ).toEqual([]);
    const locked = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let settled = false;
    const holder = db.txn(async () => {
      await db.findForUpdate('EmailTemplate', { id: template.id });
      await db.emailComponent.update({
        where: { id: b.id },
        data: { deletedAt: new Date() },
      });
      locked.resolve();
      await release.promise;
    });
    void holder.catch((error) => locked.reject(error));
    let completion: Promise<PromiseSettledResult<unknown>[]> = Promise.allSettled([holder]);
    try {
      await locked.promise;
      const recompute = recomputeDegradedComponentRefs('EmailTemplate', template.id)
        .then((result) => {
          settled = true;
          return result;
        })
        .catch((error) => {
          settled = true;
          throw error;
        });
      completion = Promise.allSettled([holder, recompute]);
      await Bun.sleep(300);
      expect(settled).toBe(false);
    } finally {
      release.resolve();
      const results = await completion;
      expect(results[0].status).toBe('fulfilled');
      expect(results[1]).toEqual({ status: 'fulfilled', value: true });
    }
    expect(
      (await db.emailTemplate.findUniqueOrThrow({ where: { id: template.id } }))
        .degradedComponentRefs,
    ).toEqual(['a', 'b']);
  });

  it('skips soft-deleted rows', async () => {
    const { entity: template } = await createEmailTemplate({
      deletedAt: new Date(),
      mjml: '{{#component:x}}{{/component:x}}',
    });
    expect(await recomputeDegradedComponentRefs('EmailTemplate', template.id)).toBe(false);
  });
});
