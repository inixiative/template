import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { type SeedFile, seedTable } from '@template/db/prisma/seed';
import { seeds } from '@template/db/prisma/seeds';
import {
  cleanupTouchedTables,
  createOrganization,
  createTag,
  createTagCategory,
} from '@template/db/test';
import { TokenValidationError } from '@template/email/errors/TokenValidationError';
import { emailSeedSavers } from '#/lib/email/emailSeedSavers';

const emailSeeds = seeds.filter((file) => file.savedByApp);

const invalidTemplate: SeedFile = {
  model: 'emailTemplate',
  savedByApp: true,
  records: [
    {
      id: '01936d42-ec00-7000-8000-0000000000f0',
      slug: 'seed-invalid',
      name: 'Seed Invalid',
      locale: 'en',
      ownerModel: 'default',
      kind: 'system',
      subject: 'Hi {{recipient.name}}',
      mjml: '<mjml><mj-body><mj-section><mj-column><mj-text>{{recipient.nickname}}</mj-text></mj-column></mj-section></mj-body></mjml>',
    },
  ],
};

afterAll(async () => {
  await cleanupTouchedTables(db);
});

describe('email seeds persist through the app save', () => {
  it('marks every email seed as saved by the app', () => {
    expect(emailSeeds.map((file) => file.model).sort()).toEqual([
      'emailComponent',
      'emailTemplate',
    ]);
  });

  it('saves the shipped components and templates with no diagnostics', async () => {
    for (const file of emailSeeds) await seedTable(file, emailSeedSavers);
    const templates = await db.emailTemplate.findMany({
      where: {
        ownerModel: 'default',
        slug: { in: ['welcome', 'email-verification', 'inquiry-invite-organization-user'] },
      },
    });
    expect(templates).toHaveLength(3);
  });

  it('fails the seed run on a template the save refuses', async () => {
    await expect(seedTable(invalidTemplate, emailSeedSavers)).rejects.toBeInstanceOf(
      TokenValidationError,
    );
    expect(await db.emailTemplate.findFirst({ where: { slug: 'seed-invalid' } })).toBeNull();
  });

  it('refuses to write email seeds directly, without the app save', async () => {
    await expect(seedTable(invalidTemplate)).rejects.toThrow(/app's save path/);
  });

  it('refuses a seeded component whose rule names a row the platform lens does not admit', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: tagCategory } = await createTagCategory(
      { ownerModel: 'Organization' },
      { organization },
    );
    const { entity: tag } = await createTag(
      { ownerModel: 'Organization' },
      { organization, tagCategory },
    );
    const rule = JSON.stringify({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'equals', value: tag.id },
    });
    const component: SeedFile = {
      model: 'emailComponent',
      savedByApp: true,
      records: [
        {
          id: '01936d42-ec00-7000-8000-0000000000f1',
          slug: 'seed-org-tag',
          locale: 'en',
          ownerModel: 'default',
          componentRefs: [],
          mjml: `<mj-text>{{#if rule=${rule}}}VIP{{/if}}</mj-text>`,
        },
      ],
    };

    await expect(seedTable(component, emailSeedSavers)).rejects.toThrow(
      /outside this source's view/,
    );
    expect(await db.emailComponent.findFirst({ where: { slug: 'seed-org-tag' } })).toBeNull();
  });
});
