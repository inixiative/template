import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { CommunicationStatus } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCommunicationLog,
  createCustomerRef,
  createOrganization,
  createSegment,
  createSegmentMember,
  createTag,
  createTagAttachment,
  createTagCategory,
  createUser,
} from '@template/db/test';
import type { SendEmailOptions } from '@template/email/client/types';
import { saveEmailTemplate } from '@template/email/render';
import { emailRegistry } from '#/lib/email';
import { deliverEmailMessage } from '#/lib/email/deliverEmailMessage';

const ADAPTER = 'link-rows-bound';
const sent: SendEmailOptions[] = [];

const atLeastTwo = (field: string) =>
  JSON.stringify({ field, arrayOperator: 'atLeast', count: 2, condition: true });

const fixture = async () => {
  const { entity: mine } = await createOrganization({ name: 'Mine' });
  const { entity: theirs } = await createOrganization({ name: 'Theirs' });
  const { entity: user } = await createUser();
  for (const organization of [mine, theirs]) {
    const { entity: tagCategory } = await createTagCategory(
      { ownerModel: 'Organization' },
      { organization },
    );
    const { entity: tag } = await createTag(
      { name: `${organization.name} tag`, ownerModel: 'Organization' },
      { organization, tagCategory },
    );
    await createTagAttachment({ resourceModel: 'User' }, { user, tag });
    const { entity: ref } = await createCustomerRef({
      customerModel: 'User',
      providerModel: 'Organization',
      customerUserId: user.id,
      providerOrganizationId: organization.id,
    });
    const { entity: segment } = await createSegment({
      name: `${organization.name} segment`,
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    await createSegmentMember({}, { segment, customerRef: ref });
  }
  return { mine, user };
};

beforeAll(() => {
  emailRegistry.register(ADAPTER, {
    send: async (options) => {
      sent.push(options);
      return { id: `sent-${sent.length}`, success: true };
    },
    sendBatch: async (batch) => batch.map((_, i) => ({ id: `batch-${i}`, success: true })),
  });
});

afterEach(async () => {
  sent.length = 0;
  await db.communicationLog.deleteMany({});
  await db.emailTemplate.deleteMany({});
});

afterAll(async () => {
  emailRegistry.unregister(ADAPTER);
  await cleanupTouchedTables(db);
});

describe("an organization's email sees only its own link rows", () => {
  it('loops and counts over tags, customer refs and segment memberships stay inside the owner', async () => {
    const { mine, user } = await fixture();
    const body = [
      '{{#each recipient.tagAttachments as=t}}[{{t.tag.name}}]{{/each}}',
      `{{#if rule=${atLeastTwo('recipient.tagAttachments')}}}TAGS2{{else}}TAGS1{{/if}}`,
      `{{#if rule=${atLeastTwo('recipient.providerRefs')}}}REFS2{{else}}REFS1{{/if}}`,
      '{{#each recipient.providerRefs as=r}}{{#each r.segmentMembers as=m}}[{{m.segment.name}}]{{/each}}{{/each}}',
    ].join('|');
    await saveEmailTemplate({
      slug: 'link-rows',
      name: 'link-rows',
      subject: 'Hi',
      kind: 'system',
      mjml: `<mjml><mj-body><mj-section><mj-column><mj-text>${body}</mj-text></mj-column></mj-section></mj-body></mjml>`,
      ownerModel: 'Organization',
      organizationId: mine.id,
    });
    const log = (
      await createCommunicationLog(
        { senderType: 'Organization', address: `${user.id}@example.com` },
        { organization: mine },
      )
    ).entity;

    await deliverEmailMessage(
      {
        template: 'link-rows',
        sender: { type: 'Organization', organizationId: mine.id },
        recipientId: user.id,
        data: {},
        communicationLogId: log.id,
      },
      { sleep: async () => {} },
    );

    const row = await db.communicationLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(row.status).toBe(CommunicationStatus.sent);
    const html = sent[0]?.html ?? '';
    expect(html).toContain('[Mine tag]|TAGS1|REFS1|[Mine segment]');
    expect(html).not.toContain('Theirs');
  });
});
