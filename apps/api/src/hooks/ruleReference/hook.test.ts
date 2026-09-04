import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, registerSoftDeleteScoper, ruleReferenceIssues } from '@template/db';
import {
  cleanupTouchedTables,
  createEmailComponent,
  createEmailTemplate,
  createSpace,
  createTag,
} from '@template/db/test';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRuleReferenceHook } from '#/hooks/ruleReference/hook';
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

const edgesOf = (where: Record<string, unknown>) => db.ruleReference.findMany({ where, orderBy: { createdAt: 'asc' } });

const refKey = (model: string, id: string) => `${model}|${id}`;

describe('ruleReference hook — edges follow every save of a rule-bearing column', () => {
  beforeAll(() => {
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
    registerPreventHardDeleteHook();
    registerRulesHook();
    registerRuleReferenceHook();
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
    const { entity: template } = await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });

    const edges = await edgesOf({ emailTemplateId: template.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      ownerModel: 'EmailTemplate',
      emailTemplateId: template.id,
      emailComponentId: null,
      referencedModel: 'Tag',
      tagId: tag.id,
      organizationId: null,
      spaceId: null,
    });
  });

  it('the subject is a surface too, and a space reference lands on the space FK', async () => {
    const { entity: space } = await createSpace();
    const { entity: template } = await createEmailTemplate({ subject: `Welcome ${inSpaceBlock(space.id)}` });

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
    const { entity: template } = await createEmailTemplate({
      mjml: mjml(`{{#if rule=${JSON.stringify(rule)}}}owner{{/if}}`),
    });

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

    await expect(
      createEmailTemplate({ mjml: mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('a typo path is refused at save instead of silently never matching', async () => {
    const rule = { field: 'recipient.zzzNope', operator: 'equals', value: 'x' };

    await expect(
      createEmailTemplate({ mjml: mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('re-saving the body set-diffs: survivors keep their row, removed edges go, added edges appear', async () => {
    const [{ entity: a }, { entity: b }, { entity: c }] = await Promise.all([createTag(), createTag(), createTag()]);
    const { entity: template } = await createEmailTemplate({ mjml: mjml(taggedBlock(a.id, b.id)) });
    const before = await edgesOf({ emailTemplateId: template.id });
    const survivor = before.find((edge) => edge.tagId === b.id);

    await db.emailTemplate.update({ where: { id: template.id }, data: { mjml: mjml(taggedBlock(b.id, c.id)) } });

    const after = await edgesOf({ emailTemplateId: template.id });
    expect(after.map((edge) => edge.tagId).sort()).toEqual([b.id, c.id].sort());
    expect(after.find((edge) => edge.tagId === b.id)).toEqual(survivor);
  });

  it('a write that does not touch a rule column leaves the edges alone', async () => {
    const { entity: tag } = await createTag();
    const { entity: template } = await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });
    const before = await edgesOf({ emailTemplateId: template.id });

    await db.emailTemplate.update({ where: { id: template.id }, data: { name: 'Renamed' } });

    expect(await edgesOf({ emailTemplateId: template.id })).toEqual(before);
  });

  it('a body with no rules clears the edges', async () => {
    const { entity: tag } = await createTag();
    const { entity: template } = await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });

    await db.emailTemplate.update({ where: { id: template.id }, data: { mjml: mjml('plain') } });

    expect(await edgesOf({ emailTemplateId: template.id })).toEqual([]);
  });

  it('components are a surface: an edge from the component, not the template that embeds it', async () => {
    const { entity: tag } = await createTag();
    const { entity: component } = await createEmailComponent({ mjml: `<mj-text>${taggedBlock(tag.id)}</mj-text>` });

    const edges = await edgesOf({ emailComponentId: component.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ ownerModel: 'EmailComponent', emailTemplateId: null, tagId: tag.id });
  });

  it('naming a row that does not exist is refused at save', async () => {
    await expect(
      createEmailTemplate({ mjml: mjml(taggedBlock('01900000-0000-7000-8000-000000000000')) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('naming a soft-deleted row is refused at save', async () => {
    const { entity: tag } = await createTag();
    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });

    await expect(createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) })).rejects.toMatchObject({ status: 422 });
  });

  it('a rule that reads the row from path is refused: the reference cannot be registered', async () => {
    const rule = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'equals', path: 'recipient.id' },
    };
    const body = `{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`;

    await expect(createEmailTemplate({ mjml: mjml(body) })).rejects.toMatchObject({ status: 422 });
  });

  it('an operator that describes the referenced row without naming it is refused', async () => {
    const rule = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'contains', value: 'abc' },
    };

    await expect(
      createEmailTemplate({ mjml: mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('soft-deleting a referenced tag stamps every edge that names it; restoring clears them', async () => {
    const { entity: tag } = await createTag();
    await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });
    await createEmailComponent({ mjml: `<mj-text>${taggedBlock(tag.id)}</mj-text>` });

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
    await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });

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
    const { entity: template } = await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });
    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });

    const edited = await db.emailTemplate.update({
      where: { id: template.id },
      data: { subject: 'Typo fixed', mjml: mjml(taggedBlock(tag.id)) },
    });
    expect(edited.subject).toBe('Typo fixed');

    await db.tag.update({ where: { id: other.id }, data: { deletedAt: new Date() } });
    await expect(
      db.emailTemplate.update({ where: { id: template.id }, data: { mjml: mjml(taggedBlock(tag.id, other.id)) } }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('a save that removes the dead reference removes its edge', async () => {
    const [{ entity: dead }, { entity: alive }] = await Promise.all([createTag(), createTag()]);
    const { entity: template } = await createEmailTemplate({ mjml: mjml(taggedBlock(dead.id)) });
    await db.tag.update({ where: { id: dead.id }, data: { deletedAt: new Date() } });
    expect(await edgesOf({ tagId: dead.id })).toHaveLength(1);

    await db.emailTemplate.update({ where: { id: template.id }, data: { mjml: mjml(taggedBlock(alive.id)) } });

    expect(await edgesOf({ tagId: dead.id })).toEqual([]);
    expect(await edgesOf({ tagId: alive.id })).toHaveLength(1);
  });

  it('the client refuses a hard delete of a referenced model', async () => {
    const { entity: tag } = await createTag();
    await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });

    await expect(db.tag.delete({ where: { id: tag.id } })).rejects.toThrow(/preventHardDelete/);
  });

  it('the registry governs the edge: an owner FK that contradicts ownerModel is refused', async () => {
    const { entity: tag } = await createTag();
    const { entity: component } = await createEmailComponent();

    await expect(
      db.ruleReference.create({
        data: { ownerModel: 'EmailTemplate', emailComponentId: component.id, referencedModel: 'Tag', tagId: tag.id },
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
