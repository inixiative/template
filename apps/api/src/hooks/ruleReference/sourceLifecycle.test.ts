import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import {
  clearHookRegistry,
  db,
  liveRuleReferenceKeys,
  registerSoftDeleteScoper,
  ruleReferenceIssues,
} from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSegment,
  createSpace,
  createTag,
} from '@template/db/test';
import { referenceKey } from '@template/shared/rules';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRuleReferenceTargetHook } from '#/hooks/ruleReference/targetHook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentRuleReferencesHook } from '#/hooks/segmentRuleReferences/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { saveEmailTemplate } from '#/lib/email/saveEmailTemplate';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';

const mjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column><mj-text>${content}</mj-text></mj-column></mj-section></mj-body></mjml>`;

const taggedBlock = (tagId: string) => {
  const rule = {
    field: 'recipient.tagAttachments',
    arrayOperator: 'any',
    condition: { field: 'tag.id', operator: 'in', value: [tagId] },
  };
  return `{{#if rule=${JSON.stringify(rule)}}}VIP{{/if}}`;
};

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

const membersOf = (segmentId: string) => ({
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: segmentId },
});

let seq = 0;
const saveTemplateNaming = (tagId: string) =>
  saveEmailTemplate({
    slug: `lifecycle-${++seq}`,
    name: 't',
    subject: 's',
    ownerModel: 'default',
    kind: 'system',
    mjml: mjml(taggedBlock(tagId)),
  });

const tombstone = (model: 'emailTemplate' | 'segment' | 'tag', id: string) =>
  (db[model] as { update: (args: unknown) => Promise<unknown> }).update({
    where: { id },
    data: { deletedAt: new Date('2026-09-30T12:00:00Z') },
  });

const revive = (model: 'emailTemplate' | 'segment' | 'tag', id: string) =>
  db.withDeleted(() =>
    (db[model] as { update: (args: unknown) => Promise<unknown> }).update({
      where: { id },
      data: { deletedAt: null },
    }),
  );

describe('ruleReference — a source takes its edges with it and brings them back', () => {
  let space: Space;

  beforeAll(async () => {
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
    registerPreventHardDeleteHook();
    registerRulesHook();
    registerSegmentConditionsHook();
    registerSegmentRuleReferencesHook();
    registerRuleReferenceTargetHook();
    registerSoftDeleteCascadeHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
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

  describe('email template source', () => {
    it('drops its edges when soft-deleted and regenerates them on revive', async () => {
      const { entity: tag } = await createTag();
      const { template } = await saveTemplateNaming(tag.id);
      expect(
        await db.ruleReference.findMany({ where: { sourceEmailTemplateId: template.id } }),
      ).toHaveLength(1);

      await tombstone('emailTemplate', template.id);
      expect(
        await db.ruleReference.findMany({ where: { sourceEmailTemplateId: template.id } }),
      ).toEqual([]);

      await revive('emailTemplate', template.id);
      const edges = await db.ruleReference.findMany({
        where: { sourceEmailTemplateId: template.id },
      });
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        targetModel: 'Tag',
        targetId: tag.id,
        targetTagId: tag.id,
      });
      expect(ruleReferenceIssues(edges)).toEqual([]);
    });

    it('comes back degraded, not refused, when the tag it names died while it was away', async () => {
      const { entity: tag } = await createTag();
      const { template } = await saveTemplateNaming(tag.id);
      await tombstone('emailTemplate', template.id);
      await tombstone('tag', tag.id);

      await revive('emailTemplate', template.id);

      const edges = await db.ruleReference.findMany({
        where: { sourceEmailTemplateId: template.id },
      });
      expect(edges[0]?.targetDeletedAt?.toISOString()).toBe('2026-09-30T12:00:00.000Z');
      expect(ruleReferenceIssues(edges).map((issue) => issue.reason)).toEqual(['deleted']);
    });

    it('comes back with no edge for a tag purged while it was away, so the tag never reads as live', async () => {
      const { entity: tag } = await createTag();
      const { template } = await saveTemplateNaming(tag.id);
      await tombstone('emailTemplate', template.id);
      await db.$executeRaw`DELETE FROM "Tag" WHERE "id" = ${tag.id}`;

      await revive('emailTemplate', template.id);

      const edges = await db.ruleReference.findMany({
        where: { sourceEmailTemplateId: template.id },
      });
      expect(edges).toEqual([]);
      expect(liveRuleReferenceKeys(edges).has(referenceKey({ model: 'Tag', id: tag.id }))).toBe(
        false,
      );
    });
  });

  describe('segment, which is both a source and a target row', () => {
    it('tombstoning a target segment keeps the edges that name it, and stamps them', async () => {
      const { entity: target } = await createSegment({ conditions: acmeRule }, { space });
      const { entity: dependent } = await createSegment(
        { conditions: membersOf(target.id) },
        { space },
      );

      await tombstone('segment', target.id);

      const edges = await db.ruleReference.findMany({ where: { sourceSegmentId: dependent.id } });
      expect(edges).toHaveLength(1);
      expect(ruleReferenceIssues(edges).map((issue) => issue.reason)).toEqual(['deleted']);
    });

    it('drops its own edges when it is tombstoned and regenerates them on revive', async () => {
      const { entity: target } = await createSegment({ conditions: acmeRule }, { space });
      const { entity: dependent } = await createSegment(
        { conditions: membersOf(target.id) },
        { space },
      );

      await tombstone('segment', dependent.id);
      expect(await db.ruleReference.findMany({ where: { sourceSegmentId: dependent.id } })).toEqual(
        [],
      );

      await revive('segment', dependent.id);
      const edges = await db.ruleReference.findMany({ where: { sourceSegmentId: dependent.id } });
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        targetModel: 'Segment',
        targetSegmentId: target.id,
      });
    });
  });
});
