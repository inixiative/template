import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import {
  cleanupTouchedTables,
  createEmailComponent,
  createEmailTemplate,
  createSpace,
  createTag,
} from '@template/db/test';
import { registerRuleReferenceDegradedHook } from '#/hooks/ruleReference/degraded';
import { registerRuleReferenceHook } from '#/hooks/ruleReference/hook';
import { registerRulesHook } from '#/hooks/rules/hook';

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
  const rule = { field: 'recipient.spaceUsers.space.id', operator: 'equals', value: spaceId };
  return `{{#if rule=${JSON.stringify(rule)}}}member{{/if}}`;
};

const edgesOf = (where: Record<string, unknown>) => db.ruleReference.findMany({ where, orderBy: { createdAt: 'asc' } });

describe('ruleReference hook — edges follow every save of a rule-bearing column', () => {
  beforeAll(() => {
    registerRulesHook();
    registerRuleReferenceHook();
    registerRuleReferenceDegradedHook();
  });

  afterAll(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  afterEach(async () => {
    await db.ruleReference.deleteMany({});
    await db.emailTemplate.deleteMany({});
    await db.emailComponent.deleteMany({});
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
    expect(template.degradedRuleRefs).toEqual([]);
  });

  it('the subject is a surface too, and a space reference lands on the space FK', async () => {
    const { entity: space } = await createSpace();
    const { entity: template } = await createEmailTemplate({ subject: `Welcome ${inSpaceBlock(space.id)}` });

    const edges = await edgesOf({ emailTemplateId: template.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ referencedModel: 'Space', spaceId: space.id, tagId: null });
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
    const rule = { field: 'recipient.tagAttachments.tag.id', operator: 'equals', path: 'data.tagId' };
    const body = `{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`;

    await expect(createEmailTemplate({ mjml: mjml(body) })).rejects.toMatchObject({ status: 422 });
  });

  it('soft-deleting a referenced tag flags every owner; restoring it un-flags them', async () => {
    const { entity: tag } = await createTag();
    const { entity: template } = await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });
    const { entity: component } = await createEmailComponent({ mjml: `<mj-text>${taggedBlock(tag.id)}</mj-text>` });

    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });
    expect((await db.emailTemplate.findUniqueOrThrow({ where: { id: template.id } })).degradedRuleRefs).toEqual([
      tag.id,
    ]);
    expect((await db.emailComponent.findUniqueOrThrow({ where: { id: component.id } })).degradedRuleRefs).toEqual([
      tag.id,
    ]);
    expect(await edgesOf({ tagId: tag.id })).toHaveLength(2);

    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: null } });
    expect((await db.emailTemplate.findUniqueOrThrow({ where: { id: template.id } })).degradedRuleRefs).toEqual([]);
    expect((await db.emailComponent.findUniqueOrThrow({ where: { id: component.id } })).degradedRuleRefs).toEqual([]);
  });

  it('a tag write that does not touch deletedAt does not re-resolve owners', async () => {
    const { entity: tag } = await createTag();
    const { entity: template } = await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });

    await db.tag.update({ where: { id: tag.id }, data: { name: 'renamed' } });

    expect((await db.emailTemplate.findUniqueOrThrow({ where: { id: template.id } })).degradedRuleRefs).toEqual([]);
  });

  it('a hard delete of the referenced row cascades its edges', async () => {
    const { entity: tag } = await createTag();
    await createEmailTemplate({ mjml: mjml(taggedBlock(tag.id)) });

    await db.tag.delete({ where: { id: tag.id } });

    expect(await edgesOf({ tagId: tag.id })).toEqual([]);
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
