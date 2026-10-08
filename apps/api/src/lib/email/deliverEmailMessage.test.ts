import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { db } from '@template/db';
import { CommunicationReasonCode, CommunicationStatus } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCommunicationLog,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import type { EmailClient, SendEmailOptions, SendEmailResult } from '@template/email/client/types';
import { EmailProviderError } from '@template/email/errors/EmailProviderError';
import { saveEmailTemplate } from '@template/email/render';
import { emailRegistry, emailVerifier } from '#/lib/email';
import { type DeliverEmailPayload, deliverEmailMessage } from '#/lib/email/deliverEmailMessage';

const ADAPTER = 'claim-policy-recorder';
const TEMPLATE = 'claim-policy-template';

const documentMjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;

const providerError = (
  classification: EmailProviderError['classification'],
  status: number | null,
) =>
  new EmailProviderError(
    'Resend',
    classification,
    status,
    `code_${classification}`,
    `${classification} failure`,
  );

describe('deliverEmailMessage — claim policy', () => {
  const attempts: SendEmailOptions[] = [];
  const outcomes: Array<Error | SendEmailResult> = [];
  const waits: number[] = [];
  const sleep = async (ms: number): Promise<void> => {
    waits.push(ms);
  };

  let fan: { id: string };

  beforeAll(async () => {
    fan = (await createUser({ email: 'fan@example.com' })).entity;
    const recorder: EmailClient = {
      send: async (options) => {
        attempts.push(options);
        const outcome = outcomes.shift();
        if (outcome instanceof Error) throw outcome;
        return outcome ?? { id: `sent-${attempts.length}`, success: true };
      },
      sendBatch: async (batch) => batch.map((_, i) => ({ id: `batch-${i}`, success: true })),
    };
    emailRegistry.register(ADAPTER, recorder);
  });

  beforeEach(async () => {
    await saveEmailTemplate({
      slug: TEMPLATE,
      name: 'Claim policy',
      subject: 'Hi',
      kind: 'system',
      mjml: documentMjml('<mj-text>Hello</mj-text>'),
      ownerModel: 'default',
    });
  });

  afterEach(async () => {
    attempts.length = 0;
    outcomes.length = 0;
    waits.length = 0;
    await db.communicationComponentVersion.deleteMany({});
    await db.communicationLog.deleteMany({});
    await db.emailTemplate.deleteMany({});
  });

  afterAll(async () => {
    emailRegistry.unregister(ADAPTER);
    await cleanupTouchedTables(db);
  });

  const createLog = async (data: Parameters<typeof createCommunicationLog>[0] = {}) =>
    (await createCommunicationLog({ address: 'fan@example.com', ...data })).entity;

  const payloadFor = (logId: string, template = TEMPLATE): DeliverEmailPayload => ({
    template,
    sender: { type: 'platform' },
    recipientId: fan.id,
    data: {},
    communicationLogId: logId,
  });

  const rowOf = (id: string) => db.communicationLog.findUniqueOrThrow({ where: { id } });

  it('sends with the communication log id as the provider idempotency key', async () => {
    const log = await createLog();

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.idempotencyKey).toBe(log.id);
    expect((await rowOf(log.id)).status).toBe(CommunicationStatus.sent);
  });

  it('retries a rate limit and a 5xx inside the claim with exponential backoff, then sends', async () => {
    const log = await createLog();
    outcomes.push(providerError('rate_limit', 429), providerError('transient', 503));

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(3);
    expect(waits).toEqual([2_000, 4_000]);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.sent);
    expect(row.reasonCode).toBeNull();
  });

  it('records rate_limit_exhausted after five retries and does not throw', async () => {
    const log = await createLog();
    for (let i = 0; i < 6; i++) outcomes.push(providerError('rate_limit', 429));

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(6);
    expect(waits).toEqual([2_000, 4_000, 8_000, 16_000, 32_000]);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.failed);
    expect(row.reasonCode).toBe(CommunicationReasonCode.rate_limit_exhausted);
  });

  it.each([
    ['ambiguous', 408, CommunicationReasonCode.ambiguous_timeout],
    ['ambiguous', null, CommunicationReasonCode.ambiguous_timeout],
    ['quota', 429, CommunicationReasonCode.quota_exceeded],
    ['validation', 422, CommunicationReasonCode.validation],
    ['auth', 401, CommunicationReasonCode.auth],
  ] as const)('closes a %s failure (status %p) on the first attempt as %s', async (classification, status, reason) => {
    const log = await createLog();
    outcomes.push(providerError(classification, status));

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(1);
    expect(waits).toEqual([]);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.failed);
    expect(row.reasonCode).toBe(reason);
  });

  it.each([
    CommunicationStatus.failed,
    CommunicationStatus.sending,
    CommunicationStatus.sent,
    CommunicationStatus.suppressed,
    CommunicationStatus.undeliverable,
  ])('never reopens a %s row', async (status) => {
    const log = await createLog({ status });

    await deliverEmailMessage(payloadFor(log.id), { sleep });

    expect(attempts).toHaveLength(0);
    expect((await rowOf(log.id)).status).toBe(status);
  });

  it('closes a render failure as render_failed without sending', async () => {
    const log = await createLog();

    await deliverEmailMessage(payloadFor(log.id, 'missing-template'), { sleep });

    expect(attempts).toHaveLength(0);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.failed);
    expect(row.reasonCode).toBe(CommunicationReasonCode.render_failed);
  });

  it('leaves the row queued and throws when an infrastructure dependency fails before the claim', async () => {
    const log = await createLog();
    const verify = spyOn(emailVerifier, 'verify').mockImplementation(async () => {
      throw new Error('verifier unavailable');
    });

    try {
      await expect(deliverEmailMessage(payloadFor(log.id), { sleep })).rejects.toThrow(
        'verifier unavailable',
      );
    } finally {
      verify.mockRestore();
    }

    expect(attempts).toHaveLength(0);
    const row = await rowOf(log.id);
    expect(row.status).toBe(CommunicationStatus.queued);
    expect(row.reasonCode).toBeNull();
  });
});

describe('deliverEmailMessage — the recipient is read through the lens at send time', () => {
  const sent: SendEmailOptions[] = [];
  const sleep = async (): Promise<void> => {};
  const RENDER_ADAPTER = 'send-time-recipient';

  beforeAll(() => {
    emailRegistry.register(RENDER_ADAPTER, {
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
    emailRegistry.unregister(RENDER_ADAPTER);
    await cleanupTouchedTables(db);
  });

  const saveTemplate = (slug: string, content: string, owner: Record<string, unknown> = {}) =>
    saveEmailTemplate({
      slug,
      name: slug,
      subject: 'Hi',
      kind: 'system',
      mjml: documentMjml(`<mj-text>${content}</mj-text>`),
      ownerModel: 'default',
      ...owner,
    });

  const deliver = async (
    template: string,
    recipientId: string,
    sender: DeliverEmailPayload['sender'] = { type: 'platform' },
    data: Record<string, unknown> = {},
  ) => {
    const log = (await createCommunicationLog({ address: `${recipientId}@example.com` })).entity;
    await deliverEmailMessage(
      { template, sender, recipientId, data, communicationLogId: log.id },
      { sleep },
    );
    return db.communicationLog.findUniqueOrThrow({ where: { id: log.id } });
  };

  it('renders the recipient as the database holds them when the job runs, not when it was queued', async () => {
    await saveTemplate('send-time-name', 'Hello {{recipient.name}}');
    const { entity: user } = await createUser({ name: 'Queued Name' });
    await db.user.update({ where: { id: user.id }, data: { name: 'Current Name' } });

    const row = await deliver('send-time-name', user.id);

    expect(row.status).toBe(CommunicationStatus.sent);
    expect(sent[0]?.html).toContain('Hello Current Name');
    expect(sent[0]?.html).not.toContain('Queued Name');
    expect(sent[0]?.to).toBe(`${user.id}@example.com`);
  });

  it('closes a send whose recipient no longer resolves as not_found, without sending', async () => {
    await saveTemplate('send-time-gone', 'Hello {{recipient.name}}');

    const row = await deliver('send-time-gone', crypto.randomUUID());

    expect(sent).toHaveLength(0);
    expect(row.status).toBe(CommunicationStatus.failed);
    expect(row.reasonCode).toBe(CommunicationReasonCode.not_found);
  });

  it("an organization's send shows only its own membership of a recipient who belongs to two", async () => {
    const { entity: mine } = await createOrganization({ name: 'Sending Org' });
    const { entity: theirs } = await createOrganization({ name: 'Other Org' });
    const { entity: user } = await createUser();
    await createOrganizationUser({ role: 'admin' }, { user, organization: mine });
    await createOrganizationUser({ role: 'member' }, { user, organization: theirs });
    await saveTemplate(
      'org-memberships',
      '{{#each recipient.organizationUsers as=m}}[{{m.organization.name}}:{{m.role}}]{{/each}}',
    );

    const row = await deliver('org-memberships', user.id, {
      type: 'Organization',
      organizationId: mine.id,
    });

    expect(row.status).toBe(CommunicationStatus.sent);
    expect(sent[0]?.html).toContain('[Sending Org:admin]');
    expect(sent[0]?.html).not.toContain('Other Org');
    expect(sent[0]?.html).not.toContain(':member]');
  });

  it("an organization's default lens shows its memberships, and its spaces' only when the lens turns them on", async () => {
    const { entity: organization } = await createOrganization({ name: 'Org Default' });
    const { entity: space } = await createSpace({ name: 'Org Space' }, { organization });
    const { entity: user } = await createUser();
    const { entity: organizationUser } = await createOrganizationUser(
      { role: 'admin' },
      { user, organization },
    );
    await createSpaceUser({ role: 'owner' }, { user, organization, space, organizationUser });
    await saveTemplate(
      'org-default-spaces',
      '{{#each recipient.spaceUsers as=m}}[{{m.space.name}}]{{/each}}',
      { ownerModel: 'Organization', organizationId: organization.id },
    );

    await saveTemplate('org-default-spaces', 'PLATFORM');

    const row = await deliver('org-default-spaces', user.id, {
      type: 'Organization',
      organizationId: organization.id,
    });

    expect(row.status).toBe(CommunicationStatus.sent);
    expect(sent[0]?.html).toContain('PLATFORM');
    expect(sent[0]?.html).not.toContain('[Org Space]');
  });

  it("a space sending with its organization's template shows that space's membership only", async () => {
    const { entity: organization } = await createOrganization({ name: 'Parent Org' });
    const { entity: space } = await createSpace({ name: 'Sending Space' }, { organization });
    const { entity: sibling } = await createSpace({ name: 'Sibling Space' }, { organization });
    const { entity: user } = await createUser();
    const { entity: organizationUser } = await createOrganizationUser(
      { role: 'member' },
      { user, organization },
    );
    await createSpaceUser({ role: 'owner' }, { user, organization, space, organizationUser });
    await createSpaceUser(
      { role: 'viewer' },
      { user, organization, space: sibling, organizationUser },
    );
    await saveTemplate(
      'space-memberships',
      '{{#each recipient.spaceUsers as=m}}[{{m.space.name}}:{{m.role}}]{{/each}}',
      { ownerModel: 'Organization', organizationId: organization.id, inheritToSpaces: true },
    );

    const row = await deliver('space-memberships', user.id, {
      type: 'Space',
      spaceId: space.id,
      organizationId: organization.id,
    });

    expect(row.status).toBe(CommunicationStatus.sent);
    expect(row.emailTemplateId).not.toBeNull();
    expect(sent[0]?.html).toContain('[Sending Space:owner]');
    expect(sent[0]?.html).not.toContain('Sibling Space');
  });

  it("a space's default lens leaves organization memberships off, so a template reading them falls back to the platform's", async () => {
    const { entity: organization } = await createOrganization({ name: 'Default Org' });
    const { entity: space } = await createSpace({ name: 'Default Space' }, { organization });
    const { entity: user } = await createUser();
    await createOrganizationUser({ role: 'member' }, { user, organization });
    await saveTemplate(
      'space-default-org',
      '{{#each recipient.organizationUsers as=o}}[{{o.organization.name}}]{{/each}}',
      { ownerModel: 'Organization', organizationId: organization.id, inheritToSpaces: true },
    );

    await saveTemplate('space-default-org', 'PLATFORM');

    const row = await deliver('space-default-org', user.id, {
      type: 'Space',
      spaceId: space.id,
      organizationId: organization.id,
    });

    expect(row.status).toBe(CommunicationStatus.sent);
    expect(sent[0]?.html).toContain('PLATFORM');
    expect(sent[0]?.html).not.toContain('[Default Org]');
  });

  it("a space whose lens turns on organization memberships sees its parent organization's, never another's", async () => {
    const { entity: organization } = await createOrganization({ name: 'Parent Org' });
    const { entity: other } = await createOrganization({ name: 'Other Org' });
    const { entity: space } = await createSpace({ name: 'Lens Space' }, { organization });
    const { entity: user } = await createUser();
    await createOrganizationUser({ role: 'admin' }, { user, organization });
    await createOrganizationUser({ role: 'member' }, { user, organization: other });
    await saveTemplate(
      'space-lens-org',
      '{{#each recipient.organizationUsers as=o}}[{{o.organization.name}}:{{o.role}}]{{/each}}',
      {
        ownerModel: 'Organization',
        organizationId: organization.id,
        inheritToSpaces: true,
        lens: {
          recipient: {
            picks: ['id', 'name', 'email'],
            relations: {
              organizationUsers: {
                picks: ['role'],
                relations: { organization: { picks: ['id', 'name'] } },
              },
            },
          },
        },
      },
    );

    const row = await deliver('space-lens-org', user.id, {
      type: 'Space',
      spaceId: space.id,
      organizationId: organization.id,
    });

    expect(row.status).toBe(CommunicationStatus.sent);
    expect(sent[0]?.html).toContain('[Parent Org:admin]');
    expect(sent[0]?.html).not.toContain('Other Org');
  });

  describe('the data entity is read through the data lens at send time', () => {
    const INVITE = 'inquiry-invite-organization-user';

    const inviteFrom = async (organizationName: string) => {
      const { entity: organization } = await createOrganization({ name: organizationName });
      const { entity: user } = await createUser();
      const { entity: inquiry } = await createInquiry({
        content: { role: 'member' },
        sourceOrganizationId: organization.id,
        targetUserId: user.id,
      });
      return { organization, user, inquiry };
    };

    const saveOverride = (organizationId: string) =>
      saveTemplate(INVITE, 'Join [{{data.sourceOrganization.name}}] as {{data.content.role}}', {
        ownerModel: 'Organization',
        organizationId,
      });

    it("an organization's override renders its own organization's name, read when the send runs", async () => {
      const { organization, user, inquiry } = await inviteFrom('Inviting Org');
      await saveOverride(organization.id);

      const row = await deliver(
        INVITE,
        user.id,
        { type: 'Organization', organizationId: organization.id },
        { id: inquiry.id, sourceOrganization: { name: 'Queued Name' } },
      );

      expect(row.status).toBe(CommunicationStatus.sent);
      expect(row.emailTemplateId).not.toBeNull();
      expect(sent[0]?.html).toContain('Join [Inviting Org] as member');
      expect(sent[0]?.html).not.toContain('Queued Name');
    });

    it("never renders another organization's name the override's clamp hides", async () => {
      const { inquiry, user } = await inviteFrom('Hidden Org');
      const { entity: sending } = await createOrganization({ name: 'Sending Org' });
      await saveOverride(sending.id);

      const row = await deliver(
        INVITE,
        user.id,
        { type: 'Organization', organizationId: sending.id },
        { id: inquiry.id, sourceOrganization: { name: 'Hidden Org' } },
      );

      expect(sent).toHaveLength(0);
      expect(row.status).toBe(CommunicationStatus.failed);
      expect(row.reasonCode).toBe(CommunicationReasonCode.render_failed);
      expect(row.error).toContain('Template not found');
    });

    it('fails a send whose payload carries no data id, without sending or retrying', async () => {
      const { organization, user } = await inviteFrom('No Id Org');
      await saveOverride(organization.id);

      const row = await deliver(INVITE, user.id, {
        type: 'Organization',
        organizationId: organization.id,
      });

      expect(sent).toHaveLength(0);
      expect(row.status).toBe(CommunicationStatus.failed);
      expect(row.reasonCode).toBe(CommunicationReasonCode.render_failed);
    });

    it('closes a send whose data entity no longer resolves as not_found, without sending', async () => {
      const { organization, user } = await inviteFrom('Gone Org');
      await saveOverride(organization.id);

      const row = await deliver(
        INVITE,
        user.id,
        { type: 'Organization', organizationId: organization.id },
        { id: crypto.randomUUID() },
      );

      expect(sent).toHaveLength(0);
      expect(row.status).toBe(CommunicationStatus.failed);
      expect(row.reasonCode).toBe(CommunicationReasonCode.not_found);
    });
  });
});
