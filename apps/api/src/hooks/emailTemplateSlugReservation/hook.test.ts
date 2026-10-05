import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createEmailTemplate, createOrganization } from '@template/db/test';
import { saveEmailTemplate } from '@template/email/render/save';
import { registerEmailTemplateSlugReservationHook } from '#/hooks/emailTemplateSlugReservation/hook';
import { registerRulesHook } from '#/hooks/rules/hook';

registerRulesHook();
registerEmailTemplateSlugReservationHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

const mjml =
  '<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>';

const templateInput = (slug: string) => ({
  slug,
  name: slug,
  subject: 'Hello',
  kind: 'system' as const,
  mjml,
});

const expectConflict = async (write: Promise<unknown>) => {
  await expect(write).rejects.toMatchObject({ status: 409 });
};

describe('emailTemplateSlugReservation hook', () => {
  beforeEach(async () => {
    await db.emailTemplate.deleteMany({});
  });

  it('refuses a default template on an admin slug', async () => {
    await saveEmailTemplate({ ...templateInput('password-reset'), ownerModel: 'admin' });

    await expectConflict(
      saveEmailTemplate({ ...templateInput('password-reset'), ownerModel: 'default' }),
    );
  });

  it('refuses a tenant template on an admin slug', async () => {
    const { entity: org } = await createOrganization();
    await saveEmailTemplate({ ...templateInput('password-reset'), ownerModel: 'admin' });

    await expectConflict(
      saveEmailTemplate({
        ...templateInput('password-reset'),
        ownerModel: 'Organization',
        organizationId: org.id,
      }),
    );
  });

  it('refuses an admin template on a slug another tier already uses', async () => {
    await saveEmailTemplate({ ...templateInput('welcome'), ownerModel: 'default' });

    await expectConflict(saveEmailTemplate({ ...templateInput('welcome'), ownerModel: 'admin' }));
  });

  it('reserves the slug in every locale', async () => {
    await saveEmailTemplate({
      ...templateInput('password-reset'),
      ownerModel: 'admin',
      locale: 'en',
    });

    await expectConflict(
      saveEmailTemplate({
        ...templateInput('password-reset'),
        ownerModel: 'default',
        locale: 'fr',
      }),
    );
  });

  it('lets the admin tier re-save its own slug and add locales', async () => {
    const first = await saveEmailTemplate({
      ...templateInput('password-reset'),
      ownerModel: 'admin',
    });
    const resaved = await saveEmailTemplate({
      ...templateInput('password-reset'),
      ownerModel: 'admin',
    });
    const french = await saveEmailTemplate({
      ...templateInput('password-reset'),
      ownerModel: 'admin',
      locale: 'fr',
    });

    expect(resaved.template.id).toBe(first.template.id);
    expect(french.template.ownerModel).toBe('admin');
  });

  it('refuses moving a row onto the admin tier while another tier holds the slug', async () => {
    await saveEmailTemplate({ ...templateInput('welcome'), ownerModel: 'default' });
    const { entity: org } = await createOrganization();
    const tenant = await saveEmailTemplate({
      ...templateInput('welcome'),
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    await expectConflict(
      db.txn(() =>
        db.emailTemplate.update({
          where: { id: tenant.template.id },
          data: { ownerModel: 'admin', organizationId: null },
        }),
      ),
    );
  });

  it('guards writes that bypass saveEmailTemplate', async () => {
    await saveEmailTemplate({ ...templateInput('password-reset'), ownerModel: 'admin' });

    await expectConflict(createEmailTemplate({ slug: 'password-reset', ownerModel: 'default' }));
  });

  it('refuses a batch that puts admin and non-admin rows on one slug', async () => {
    await expectConflict(
      db.txn(() =>
        db.emailTemplate.createManyAndReturn({
          data: [
            { ...templateInput('contested'), ownerModel: 'admin' },
            { ...templateInput('contested'), ownerModel: 'default', locale: 'fr' },
          ],
        }),
      ),
    );
  });

  it('a soft-deleted admin template still reserves its slug, and re-saving revives it', async () => {
    const admin = await saveEmailTemplate({ ...templateInput('retired'), ownerModel: 'admin' });
    await db.txn(() =>
      db.emailTemplate.update({
        where: { id: admin.template.id },
        data: { deletedAt: new Date() },
      }),
    );

    await expectConflict(saveEmailTemplate({ ...templateInput('retired'), ownerModel: 'default' }));

    const revived = await saveEmailTemplate({ ...templateInput('retired'), ownerModel: 'admin' });
    expect(revived.template.id).toBe(admin.template.id);
    expect(revived.template.deletedAt).toBeNull();
  });

  it('an admin slug deleted and revived twice stays one row with one id', async () => {
    const admin = await saveEmailTemplate({ ...templateInput('cycled'), ownerModel: 'admin' });

    for (let round = 0; round < 2; round++) {
      await db.txn(() =>
        db.emailTemplate.update({
          where: { id: admin.template.id },
          data: { deletedAt: new Date() },
        }),
      );
      await expectConflict(
        saveEmailTemplate({ ...templateInput('cycled'), ownerModel: 'default' }),
      );

      const revived = await saveEmailTemplate({ ...templateInput('cycled'), ownerModel: 'admin' });
      expect(revived.template.id).toBe(admin.template.id);
    }

    const rows = await db.withDeleted(() =>
      db.emailTemplate.findMany({ where: { slug: 'cycled' } }),
    );
    expect(rows.map((row) => [row.id, row.ownerModel, row.deletedAt])).toEqual([
      [admin.template.id, 'admin', null],
    ]);
  });

  it('a soft-deleted tenant template still holds its slug against a new admin template', async () => {
    const { entity: org } = await createOrganization();
    const tenant = await saveEmailTemplate({
      ...templateInput('welcome'),
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    await db.txn(() =>
      db.emailTemplate.update({
        where: { id: tenant.template.id },
        data: { deletedAt: new Date() },
      }),
    );

    await expectConflict(saveEmailTemplate({ ...templateInput('welcome'), ownerModel: 'admin' }));
  });

  it('lets exactly one of two concurrent saves claim a slug across tiers', async () => {
    const results = await Promise.allSettled([
      saveEmailTemplate({ ...templateInput('contested'), ownerModel: 'admin' }),
      saveEmailTemplate({ ...templateInput('contested'), ownerModel: 'default' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [rejected] = results.filter((result) => result.status === 'rejected');
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    expect(await db.emailTemplate.count({ where: { slug: 'contested' } })).toBe(1);
  });
});
