import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, registerSoftDeleteScoper, ruleReferenceIssues } from '@template/db';
import { cleanupTouchedTables, createEmailComponent, createSpace, createTag } from '@template/db/test';
import { saveEmailTemplate } from '@template/email/render';
import { RuleReferenceError } from '@template/email/rules';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRuleReferenceReferencedHook } from '#/hooks/ruleReference/referencedHook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';

const mjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column><mj-text>${content}</mj-text></mj-column></mj-section></mj-body></mjml>`;

const taggedBlock = (...tagIds: string[]) => {
  const rule = {
    field: 'recipient.tagAttachments',
    arrayOperator: 'any',
    condition: { field: 'tag.id', operator: 'in', value: tagIds },
  };
  return `{{#if rule=${JSON.stringify(rule)}}}VIP{{/if}}`;
};

const inSpaceBlock = (spaceId: string) => {
  const rule = {
    field: 'recipient.spaceUsers',
    arrayOperator: 'any',
    condition: { field: 'space.id', operator: 'equals', value: spaceId },
  };
  return `{{#if rule=${JSON.stringify(rule)}}}member{{/if}}`;
};

const component = (slug: string, content: string) =>
  `{{#component:${slug}}}<mj-text>${content}</mj-text>{{/component:${slug}}}`;

let seq = 0;
const save = (body: string, extra: { subject?: string; slug?: string } = {}) =>
  saveEmailTemplate({
    slug: extra.slug ?? `t-${++seq}`,
    name: 't',
    subject: 's',
    ownerModel: 'default',
    kind: 'system',
    mjml: body,
    ...extra,
  });

const edgesOf = (where: Record<string, unknown>) => db.ruleReference.findMany({ where, orderBy: { createdAt: 'asc' } });

const refKey = (model: string, id: string) => `${model}|${id}`;

describe('ruleReference — the save path writes edges, the referenced side stamps them', () => {
  beforeAll(() => {
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
    registerPreventHardDeleteHook();
    registerRulesHook();
    registerRuleReferenceReferencedHook();
  });

  afterAll(async () => {
    clearHookRegistry();
    registerSoftDeleteScoper(null);
    await cleanupTouchedTables(db);
  });

  afterEach(async () => {
    await db.ruleReference.deleteMany({});
    await db.withDeleted(async () => {
      await db.$executeRaw`DELETE FROM "EmailTemplate"`;
      await db.$executeRaw`DELETE FROM "EmailComponent"`;
    });
  });

  it('a template naming a tag in its body gets one typed edge to that tag', async () => {
    const { entity: tag } = await createTag();
    const { template } = await save(mjml(taggedBlock(tag.id)));

    const edges = await edgesOf({ emailTemplateId: template.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      ownerModel: 'EmailTemplate',
      emailTemplateId: template.id,
      emailComponentId: null,
      referencedModel: 'Tag',
      referencedId: tag.id,
      tagId: tag.id,
      organizationId: null,
      spaceId: null,
    });
  });

  it('the subject is a surface too, and a space reference lands on the space FK', async () => {
    const { entity: space } = await createSpace();
    const { template } = await save(mjml('hi'), { subject: `Welcome ${inSpaceBlock(space.id)}` });

    const edges = await edgesOf({ emailTemplateId: template.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ referencedModel: 'Space', spaceId: space.id, tagId: null });
  });

  it('an undeclared relation path to a referenceable id still registers — the source is the model, not the path', async () => {
    const { entity: tag } = await createTag();
    const rule = {
      field: 'recipient.tags',
      arrayOperator: 'any',
      condition: { field: 'id', operator: 'equals', value: tag.id },
    };
    const { template } = await save(mjml(`{{#if rule=${JSON.stringify(rule)}}}owner{{/if}}`));

    const edges = await edgesOf({ emailTemplateId: template.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ referencedModel: 'Tag', tagId: tag.id });
  });

  it('the FK-column spelling of a reference is refused at save — outside the lens vocabulary', async () => {
    const { entity: tag } = await createTag();
    const rule = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tagId', operator: 'equals', value: tag.id },
    };

    await expect(save(mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`))).rejects.toBeInstanceOf(RuleReferenceError);
  });

  it('a typo path is refused at save instead of silently never matching', async () => {
    const rule = { field: 'recipient.zzzNope', operator: 'equals', value: 'x' };

    await expect(save(mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`))).rejects.toBeInstanceOf(RuleReferenceError);
  });

  it('re-saving the body set-diffs: survivors keep their row, removed edges go, added edges appear', async () => {
    const [{ entity: a }, { entity: b }, { entity: c }] = await Promise.all([createTag(), createTag(), createTag()]);
    const { template } = await save(mjml(taggedBlock(a.id, b.id)), { slug: 'diff' });
    const before = await edgesOf({ emailTemplateId: template.id });
    const survivor = before.find((edge) => edge.tagId === b.id);

    await save(mjml(taggedBlock(b.id, c.id)), { slug: 'diff' });

    const after = await edgesOf({ emailTemplateId: template.id });
    expect(after.map((edge) => edge.tagId).sort()).toEqual([b.id, c.id].sort());
    expect(after.find((edge) => edge.tagId === b.id)).toEqual(survivor);
  });

  it('a body with no rules clears the edges', async () => {
    const { entity: tag } = await createTag();
    const { template } = await save(mjml(taggedBlock(tag.id)), { slug: 'clear' });

    await save(mjml('plain'), { slug: 'clear' });

    expect(await edgesOf({ emailTemplateId: template.id })).toEqual([]);
  });

  it('components are a surface: an edge from the component, not the template that embeds it', async () => {
    const { entity: tag } = await createTag();
    const { template, components } = await save(mjml(component('vip', taggedBlock(tag.id))));

    expect(await edgesOf({ emailTemplateId: template.id })).toEqual([]);
    const edges = await edgesOf({ emailComponentId: components[0]!.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ ownerModel: 'EmailComponent', emailTemplateId: null, tagId: tag.id });
  });

  it('naming a row that does not exist is refused at save', async () => {
    await expect(save(mjml(taggedBlock('01900000-0000-7000-8000-000000000000')))).rejects.toBeInstanceOf(
      RuleReferenceError,
    );
  });

  it('naming a soft-deleted row is refused at save', async () => {
    const { entity: tag } = await createTag();
    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });

    await expect(save(mjml(taggedBlock(tag.id)))).rejects.toBeInstanceOf(RuleReferenceError);
  });

  it('a rule that reads the row from path is refused: the reference cannot be registered', async () => {
    const rule = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'equals', path: 'recipient.id' },
    };

    await expect(save(mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`))).rejects.toBeInstanceOf(RuleReferenceError);
  });

  it('an operator that describes the referenced row without naming it is refused', async () => {
    const rule = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'contains', value: 'abc' },
    };

    await expect(save(mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`))).rejects.toBeInstanceOf(RuleReferenceError);
  });

  it('soft-deleting a referenced tag stamps every edge that names it; restoring clears them', async () => {
    const { entity: tag } = await createTag();
    await save(mjml(taggedBlock(tag.id)));
    await save(mjml(component('vip', taggedBlock(tag.id))));

    expect(ruleReferenceIssues(await edgesOf({ referencedId: tag.id }))).toEqual([]);

    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });
    const stamped = await edgesOf({ referencedId: tag.id });
    expect(stamped).toHaveLength(2);
    expect(stamped.every((edge) => edge.referencedDeletedAt != null)).toBe(true);
    expect(ruleReferenceIssues(stamped).map((issue) => [issue.key, issue.reason])).toEqual([
      [refKey('Tag', tag.id), 'deleted'],
      [refKey('Tag', tag.id), 'deleted'],
    ]);

    await db.withDeleted(() => db.tag.update({ where: { id: tag.id }, data: { deletedAt: null } }));
    const cleared = await edgesOf({ referencedId: tag.id });
    expect(cleared.every((edge) => edge.referencedDeletedAt == null)).toBe(true);
    expect(ruleReferenceIssues(cleared)).toEqual([]);
  });

  it('purging a referenced row nulls the FK and leaves the edge naming it', async () => {
    const { entity: tag } = await createTag();
    await save(mjml(taggedBlock(tag.id)));

    await db.$executeRaw`DELETE FROM "TagAttachment" WHERE "tagId" = ${tag.id}`;
    await db.$executeRaw`DELETE FROM "Tag" WHERE "id" = ${tag.id}`;

    const edges = await edgesOf({ referencedId: tag.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]!.tagId).toBeNull();
    expect(edges[0]!.referencedId).toBe(tag.id);
    expect(ruleReferenceIssues(edges).map((issue) => issue.reason)).toEqual(['purged']);
  });

  it('an edit that keeps a pre-existing dead reference is allowed; adding a new dead one is not', async () => {
    const [{ entity: tag }, { entity: other }] = await Promise.all([createTag(), createTag()]);
    await save(mjml(taggedBlock(tag.id)), { slug: 'edit' });
    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });

    const { template: edited } = await save(mjml(taggedBlock(tag.id)), { slug: 'edit', subject: 'Typo fixed' });
    expect(edited.subject).toBe('Typo fixed');

    await db.tag.update({ where: { id: other.id }, data: { deletedAt: new Date() } });
    await expect(save(mjml(taggedBlock(tag.id, other.id)), { slug: 'edit' })).rejects.toBeInstanceOf(
      RuleReferenceError,
    );
  });

  it('a save that removes the dead reference removes its edge', async () => {
    const [{ entity: dead }, { entity: alive }] = await Promise.all([createTag(), createTag()]);
    await save(mjml(taggedBlock(dead.id)), { slug: 'rm' });
    await db.tag.update({ where: { id: dead.id }, data: { deletedAt: new Date() } });
    expect(await edgesOf({ tagId: dead.id })).toHaveLength(1);

    await save(mjml(taggedBlock(alive.id)), { slug: 'rm' });

    expect(await edgesOf({ tagId: dead.id })).toEqual([]);
    expect(await edgesOf({ tagId: alive.id })).toHaveLength(1);
  });

  it('the client refuses a hard delete of a referenced model', async () => {
    const { entity: tag } = await createTag();
    await save(mjml(taggedBlock(tag.id)));

    await expect(db.tag.delete({ where: { id: tag.id } })).rejects.toThrow(/preventHardDelete/);
  });

  it('the registry governs the edge: an owner FK that contradicts ownerModel is refused', async () => {
    const { entity: tag } = await createTag();
    const { entity: comp } = await createEmailComponent();

    await expect(
      db.ruleReference.create({
        data: {
          ownerModel: 'EmailTemplate',
          emailComponentId: comp.id,
          referencedModel: 'Tag',
          referencedId: tag.id,
          tagId: tag.id,
        },
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
