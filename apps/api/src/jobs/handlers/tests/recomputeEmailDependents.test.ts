import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { db, revive } from '@template/db';
import { cleanupTouchedTables, createEmailComponent, createEmailTemplate } from '@template/db/test';
import { createTestWorker } from '#tests/createTestWorker';

const mjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;

const runRestamp = (slug: string) =>
  createTestWorker({ name: 'recomputeEmailDependents', id: Bun.randomUUIDv7() }).run({ slug });

const badges = async (ids: { components: string[]; templates: string[] }) => ({
  components: (
    await db.emailComponent.findMany({
      where: { id: { in: ids.components } },
      orderBy: { id: 'asc' },
    })
  ).map((row) => [row.slug, row.degradedComponentRefs]),
  templates: (
    await db.emailTemplate.findMany({
      where: { id: { in: ids.templates } },
      orderBy: { id: 'asc' },
    })
  ).map((row) => [row.slug, row.degradedComponentRefs]),
});

// logo is rendered by `direct` itself and by `nested` only through the header component.
const seedLogoConsumers = async () => {
  const { entity: logo } = await createEmailComponent({ slug: 'logo' });
  const { entity: header } = await createEmailComponent({
    slug: 'header',
    mjml: '<mj-text>Header</mj-text>{{#component:logo}}{{/component:logo}}',
    componentRefs: ['logo'],
  });
  const { entity: direct } = await createEmailTemplate({
    slug: 'direct',
    mjml: mjml('{{#component:logo}}{{/component:logo}}'),
    componentRefs: ['logo'],
  });
  const { entity: nested } = await createEmailTemplate({
    slug: 'nested',
    mjml: mjml('{{#component:header}}{{/component:header}}'),
    componentRefs: ['header'],
  });
  const { entity: unrelated } = await createEmailTemplate({
    slug: 'unrelated',
    mjml: mjml('<mj-text>No components</mj-text>'),
  });
  return {
    logo,
    ids: { components: [header.id], templates: [direct.id, nested.id, unrelated.id] },
  };
};

describe('recomputeEmailDependents handler', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  afterEach(async () => {
    await db.emailTemplate.deleteMany({});
    await db.emailComponent.deleteMany({});
  });

  it('degrades every consumer of a deleted component, including one reached only through a component', async () => {
    const { logo, ids } = await seedLogoConsumers();
    await db.emailComponent.update({ where: { id: logo.id }, data: { deletedAt: new Date() } });

    await runRestamp('logo');

    expect(await badges(ids)).toEqual({
      components: [['header', ['logo']]],
      templates: [
        ['direct', ['logo']],
        ['nested', ['logo']],
        ['unrelated', []],
      ],
    });
  });

  it('heals every consumer when the deleted component is revived', async () => {
    const { logo, ids } = await seedLogoConsumers();
    await db.emailComponent.update({ where: { id: logo.id }, data: { deletedAt: new Date() } });
    await runRestamp('logo');

    await revive(db.emailComponent, { id: logo.id });
    await runRestamp('logo');

    expect(await badges(ids)).toEqual({
      components: [['header', []]],
      templates: [
        ['direct', []],
        ['nested', []],
        ['unrelated', []],
      ],
    });
  });
});
