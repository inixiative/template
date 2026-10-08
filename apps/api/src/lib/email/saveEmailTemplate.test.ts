import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, RuleReferenceError, registerSoftDeleteScoper } from '@template/db';
import type { Organization, Segment, Tag } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createSegment,
  createTag,
} from '@template/db/test';
import { registerRulesHook } from '#/hooks/rules/hook';
import { saveEmailTemplate } from '#/lib/email/saveEmailTemplate';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';

const mjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column><mj-text>${content}</mj-text></mj-column></mj-section></mj-body></mjml>`;

const taggedBlock = (tagId: string) =>
  `{{#if rule=${JSON.stringify({
    field: 'recipient.tagAttachments',
    arrayOperator: 'any',
    condition: { field: 'tag.id', operator: 'equals', value: tagId },
  })}}}VIP{{/if}}`;

const inSegmentBlock = (segmentId: string) =>
  `{{#if rule=${JSON.stringify({
    field: 'recipient.providerRefs',
    arrayOperator: 'any',
    condition: {
      field: 'segmentMembers',
      arrayOperator: 'any',
      condition: { field: 'segment.id', operator: 'equals', value: segmentId },
    },
  })}}}IN{{/if}}`;

let seq = 0;
const saveFor = (organizationId: string, body: string) =>
  saveEmailTemplate({
    slug: `owned-${++seq}`,
    name: 'owned',
    subject: 's',
    kind: 'system',
    mjml: mjml(body),
    ownerModel: 'Organization',
    organizationId,
  });

describe('saveEmailTemplate — a rule may only name what its owner can see', () => {
  let mine: Organization;
  let theirs: Organization;
  let platformTag: Tag;
  let myTag: Tag;
  let theirTag: Tag;
  let mySegment: Segment;
  let theirSegment: Segment;

  beforeAll(async () => {
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
    registerRulesHook();
    mine = (await createOrganization()).entity;
    theirs = (await createOrganization()).entity;
    platformTag = (await createTag()).entity;
    myTag = (await createTag({ ownerModel: 'Organization' }, { organization: mine })).entity;
    theirTag = (await createTag({ ownerModel: 'Organization' }, { organization: theirs })).entity;
    mySegment = (await createSegment({ ownerModel: 'Organization' }, { organization: mine }))
      .entity;
    theirSegment = (await createSegment({ ownerModel: 'Organization' }, { organization: theirs }))
      .entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
    registerSoftDeleteScoper(null);
  });

  it("platform tags and the owner's own tags and segments are admitted", async () => {
    const saved = await saveFor(
      mine.id,
      `${taggedBlock(platformTag.id)}${taggedBlock(myTag.id)}${inSegmentBlock(mySegment.id)}`,
    );
    const edges = await db.ruleReference.findMany({
      where: { sourceEmailTemplateId: saved.template.id },
    });
    expect(edges.map((edge) => edge.targetId).sort()).toEqual(
      [platformTag.id, myTag.id, mySegment.id].sort(),
    );
  });

  it("another owner's tag is refused", async () => {
    await expect(saveFor(mine.id, taggedBlock(theirTag.id))).rejects.toBeInstanceOf(
      RuleReferenceError,
    );
  });

  it("another owner's segment is refused", async () => {
    await expect(saveFor(mine.id, inSegmentBlock(theirSegment.id))).rejects.toBeInstanceOf(
      RuleReferenceError,
    );
  });

  it('a tag named by a value read at evaluation is refused: no save can check which rows it names', async () => {
    const byPrefix = `{{#if rule=${JSON.stringify({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'startsWith', value: myTag.id.slice(0, 8) },
    })}}}VIP{{/if}}`;
    await expect(saveFor(mine.id, byPrefix)).rejects.toThrow(
      'rule names a Tag by a value read at evaluation (recipient.User.tagAttachments.tag.id); name it by id',
    );
  });

  it('a platform template sees platform tags only', async () => {
    await expect(
      saveEmailTemplate({
        slug: `platform-${++seq}`,
        name: 'p',
        subject: 's',
        kind: 'system',
        mjml: mjml(taggedBlock(myTag.id)),
        ownerModel: 'default',
      }),
    ).rejects.toBeInstanceOf(RuleReferenceError);
  });
});

describe('saveEmailTemplate — a stored lens only narrows the declared surface', () => {
  it('refuses a template whose stored recipient lens turns on sessions', async () => {
    await expect(
      saveEmailTemplate({
        slug: `stored-sessions-${++seq}`,
        name: 'stored',
        subject: 's',
        kind: 'system',
        mjml: mjml('{{#each recipient.sessions as=s}}{{s.token}}{{/each}}'),
        ownerModel: 'default',
        lens: {
          recipient: { picks: ['id', 'email'], relations: { sessions: { picks: ['token'] } } },
        },
      }),
    ).rejects.toThrow(/sessions/);
  });
});
