import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import {
  clearHookRegistry,
  db,
  RuleReferenceError,
  registerSoftDeleteScoper,
  ruleReferenceIssues,
} from '@template/db';
import {
  cleanupTouchedTables,
  createEmailComponent,
  createRuleReference,
  createSpace,
  createTag,
} from '@template/db/test';
import { ConditionValidationError } from '@template/email/errors';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRuleReferenceTargetHook } from '#/hooks/ruleReference/targetHook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { saveEmailTemplate } from '#/lib/email/saveEmailTemplate';
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

const edgesOf = (where: Record<string, unknown>) =>
  db.ruleReference.findMany({ where, orderBy: { createdAt: 'asc' } });

const refKey = (model: string, id: string) => `${model}|${id}`;

describe('ruleReference — the save path writes edges, the target side stamps them', () => {
  beforeAll(() => {
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
    registerPreventHardDeleteHook();
    registerRulesHook();
    registerRuleReferenceTargetHook();
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

    const edges = await edgesOf({ sourceEmailTemplateId: template.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      sourceModel: 'EmailTemplate',
      sourceEmailTemplateId: template.id,
      sourceEmailComponentId: null,
      targetModel: 'Tag',
      targetId: tag.id,
      targetTagId: tag.id,
      targetOrganizationId: null,
      targetSpaceId: null,
    });
  });

  it('the subject is a surface too, and a space reference lands on the space FK', async () => {
    const { entity: space } = await createSpace();
    const { template } = await save(mjml('hi'), { subject: `Welcome ${inSpaceBlock(space.id)}` });

    const edges = await edgesOf({ sourceEmailTemplateId: template.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      targetModel: 'Space',
      targetSpaceId: space.id,
      targetTagId: null,
    });
  });

  it('a relation the lens does not declare is refused at save, even when it reaches a referenceable id', async () => {
    const { entity: tag } = await createTag();
    const rule = {
      field: 'recipient.tags',
      arrayOperator: 'any',
      condition: { field: 'id', operator: 'equals', value: tag.id },
    };

    await expect(
      save(mjml(`{{#if rule=${JSON.stringify(rule)}}}owner{{/if}}`)),
    ).rejects.toBeInstanceOf(ConditionValidationError);
  });

  it('the FK-column spelling of a reference is refused at save — outside the lens vocabulary', async () => {
    const { entity: tag } = await createTag();
    const rule = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tagId', operator: 'equals', value: tag.id },
    };

    await expect(save(mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`))).rejects.toBeInstanceOf(
      ConditionValidationError,
    );
  });

  it('a typo path is refused at save instead of silently never matching', async () => {
    const rule = { field: 'recipient.zzzNope', operator: 'equals', value: 'x' };

    await expect(save(mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`))).rejects.toBeInstanceOf(
      ConditionValidationError,
    );
  });

  it('re-saving the body set-diffs: survivors keep their row, removed edges go, added edges appear', async () => {
    const [{ entity: a }, { entity: b }, { entity: c }] = await Promise.all([
      createTag(),
      createTag(),
      createTag(),
    ]);
    const { template } = await save(mjml(taggedBlock(a.id, b.id)), { slug: 'diff' });
    const before = await edgesOf({ sourceEmailTemplateId: template.id });
    const survivor = before.find((edge) => edge.targetTagId === b.id);

    await save(mjml(taggedBlock(b.id, c.id)), { slug: 'diff' });

    const after = await edgesOf({ sourceEmailTemplateId: template.id });
    expect(after.map((edge) => edge.targetTagId).sort()).toEqual([b.id, c.id].sort());
    expect(after.find((edge) => edge.targetTagId === b.id)).toEqual(survivor);
  });

  it('a body with no rules clears the edges', async () => {
    const { entity: tag } = await createTag();
    const { template } = await save(mjml(taggedBlock(tag.id)), { slug: 'clear' });

    await save(mjml('plain'), { slug: 'clear' });

    expect(await edgesOf({ sourceEmailTemplateId: template.id })).toEqual([]);
  });

  it('components are a surface: an edge from the component, not the template that embeds it', async () => {
    const { entity: tag } = await createTag();
    const { template, components } = await save(mjml(component('vip', taggedBlock(tag.id))));

    expect(await edgesOf({ sourceEmailTemplateId: template.id })).toEqual([]);
    const edges = await edgesOf({ sourceEmailComponentId: components[0]!.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      sourceModel: 'EmailComponent',
      sourceEmailTemplateId: null,
      targetTagId: tag.id,
    });
  });

  it('naming a row that does not exist is refused at save', async () => {
    await expect(
      save(mjml(taggedBlock('01900000-0000-7000-8000-000000000000'))),
    ).rejects.toBeInstanceOf(RuleReferenceError);
  });

  it('naming a soft-deleted row is refused at save', async () => {
    const { entity: tag } = await createTag();
    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });

    await expect(save(mjml(taggedBlock(tag.id)))).rejects.toBeInstanceOf(RuleReferenceError);
  });

  it('a rule that reads the row from path names no checkable row: save refuses it', async () => {
    const rule = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'equals', path: 'recipient.id' },
    };

    await expect(save(mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`))).rejects.toThrow(
      'rule names a Tag by a value read at evaluation',
    );
  });

  it('an operator that describes the target row without naming it is refused at save', async () => {
    const rule = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'contains', value: 'abc' },
    };

    await expect(save(mjml(`{{#if rule=${JSON.stringify(rule)}}}x{{/if}}`))).rejects.toThrow(
      'rule names a Tag by a value read at evaluation',
    );
  });

  it('soft-deleting a target tag stamps every edge that names it; restoring clears them', async () => {
    const { entity: tag } = await createTag();
    await save(mjml(taggedBlock(tag.id)));
    await save(mjml(component('vip', taggedBlock(tag.id))));

    expect(ruleReferenceIssues(await edgesOf({ targetId: tag.id }))).toEqual([]);

    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });
    const stamped = await edgesOf({ targetId: tag.id });
    expect(stamped).toHaveLength(2);
    expect(stamped.every((edge) => edge.targetDeletedAt != null)).toBe(true);
    expect(ruleReferenceIssues(stamped).map((issue) => [issue.key, issue.reason])).toEqual([
      [refKey('Tag', tag.id), 'deleted'],
      [refKey('Tag', tag.id), 'deleted'],
    ]);

    await db.withDeleted(() => db.tag.update({ where: { id: tag.id }, data: { deletedAt: null } }));
    const cleared = await edgesOf({ targetId: tag.id });
    expect(cleared.every((edge) => edge.targetDeletedAt == null)).toBe(true);
    expect(ruleReferenceIssues(cleared)).toEqual([]);
  });

  it('soft-deleting a target row publishes one stale event per edge, naming the source; restoring publishes none', async () => {
    const { entity: tag } = await createTag();
    await save(mjml(taggedBlock(tag.id)));
    await save(mjml(component('vip', taggedBlock(tag.id))));

    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });

    const stamped = await edgesOf({ targetId: tag.id });
    const staleEvents = () =>
      db.appEvent.findMany({
        where: { name: 'ruleReference.stale', data: { path: ['targetId'], equals: tag.id } },
      });
    const published = (await staleEvents()).map((event) => event.data as Record<string, unknown>);
    expect(published.map((data) => [data.sourceModel, data.sourceId]).sort()).toEqual(
      stamped
        .map((edge) => [
          edge.sourceModel,
          edge.sourceEmailTemplateId ?? edge.sourceEmailComponentId,
        ])
        .sort(),
    );
    expect(published.every((data) => data.targetModel === 'Tag')).toBe(true);

    await db.withDeleted(() => db.tag.update({ where: { id: tag.id }, data: { deletedAt: null } }));
    expect(await staleEvents()).toHaveLength(published.length);
  });

  it('purging a target row nulls the FK and leaves the edge naming it', async () => {
    const { entity: tag } = await createTag();
    await save(mjml(taggedBlock(tag.id)));

    await db.$executeRaw`DELETE FROM "TagAttachment" WHERE "tagId" = ${tag.id}`;
    await db.$executeRaw`DELETE FROM "Tag" WHERE "id" = ${tag.id}`;

    const edges = await edgesOf({ targetId: tag.id });
    expect(edges).toHaveLength(1);
    expect(edges[0]!.targetTagId).toBeNull();
    expect(edges[0]!.targetId).toBe(tag.id);
    expect(ruleReferenceIssues(edges).map((issue) => issue.reason)).toEqual(['purged']);
  });

  it('an edit that keeps a pre-existing dead reference is allowed; adding a new dead one is not', async () => {
    const [{ entity: tag }, { entity: other }] = await Promise.all([createTag(), createTag()]);
    await save(mjml(taggedBlock(tag.id)), { slug: 'edit' });
    await db.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });

    const { template: edited } = await save(mjml(taggedBlock(tag.id)), {
      slug: 'edit',
      subject: 'Typo fixed',
    });
    expect(edited.subject).toBe('Typo fixed');

    await db.tag.update({ where: { id: other.id }, data: { deletedAt: new Date() } });
    await expect(
      save(mjml(taggedBlock(tag.id, other.id)), { slug: 'edit' }),
    ).rejects.toBeInstanceOf(RuleReferenceError);
  });

  it('a save that removes the dead reference removes its edge', async () => {
    const [{ entity: dead }, { entity: alive }] = await Promise.all([createTag(), createTag()]);
    await save(mjml(taggedBlock(dead.id)), { slug: 'rm' });
    await db.tag.update({ where: { id: dead.id }, data: { deletedAt: new Date() } });
    expect(await edgesOf({ targetTagId: dead.id })).toHaveLength(1);

    await save(mjml(taggedBlock(alive.id)), { slug: 'rm' });

    expect(await edgesOf({ targetTagId: dead.id })).toEqual([]);
    expect(await edgesOf({ targetTagId: alive.id })).toHaveLength(1);
  });

  it('the client refuses a hard delete of a target model', async () => {
    const { entity: tag } = await createTag();
    await save(mjml(taggedBlock(tag.id)));

    await expect(db.tag.delete({ where: { id: tag.id } })).rejects.toThrow(/preventHardDelete/);
  });

  it('the registry governs the edge: a source FK that contradicts sourceModel is refused', async () => {
    const { entity: tag } = await createTag();
    const { entity: comp } = await createEmailComponent();

    await expect(
      createRuleReference({
        sourceModel: 'EmailTemplate',
        sourceEmailComponentId: comp.id,
        targetModel: 'Tag',
        targetId: tag.id,
        targetTagId: tag.id,
      }),
    ).rejects.toThrow('RuleReference sourceModel=EmailTemplate needs sourceEmailTemplateId');
  });
});
