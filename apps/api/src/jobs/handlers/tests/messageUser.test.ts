import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { ContactType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createContact,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { saveEmailTemplate } from '@template/email/render';
import { messageUser } from '#/jobs/handlers/messageUser';
import { recipientVariables } from '#/lib/email/renderForRecipient';
import { settleTemplate } from '#/lib/emailTemplate';
import { type MessageContent, messageProviderRegistry } from '#/lib/messaging/providers';
import { createTestApp } from '#tests/createTestApp';
import { createTestWorker } from '#tests/createTestWorker';

type DispatchedCall = {
  contactId: string;
  contactType: ContactType;
  content: MessageContent;
};

describe('messageUser handler', () => {
  let testDb: ReturnType<typeof createTestApp>['db'];
  const dispatched: DispatchedCall[] = [];
  const worker = createTestWorker();

  beforeAll(() => {
    const harness = createTestApp({});
    testDb = harness.db;

    // Real adapter, not a mock — registry is the actual wire used by messageUser.
    const recorder = async (
      contact: { id: string; type: ContactType },
      content: MessageContent,
    ) => {
      dispatched.push({ contactId: contact.id, contactType: contact.type, content });
    };
    messageProviderRegistry.register(ContactType.whatsapp, recorder as never);
    messageProviderRegistry.register(ContactType.telegram, recorder as never);
  });

  afterAll(async () => {
    messageProviderRegistry.unregister(ContactType.whatsapp);
    messageProviderRegistry.unregister(ContactType.telegram);
    await cleanupTouchedTables(testDb);
  });

  beforeEach(() => {
    dispatched.length = 0;
  });

  afterEach(() => {
    dispatched.length = 0;
  });

  it('fans out across every contact a user has', async () => {
    const { entity: user } = await createUser();
    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.whatsapp,
        value: { jid: '111' },
        acceptedKinds: ['platform'],
      },
      { user },
    );
    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.telegram,
        value: { handle: '@one' },
        acceptedKinds: ['platform'],
      },
      { user },
    );

    await messageUser(worker, {
      rule: { field: 'id', operator: Operator.equals, value: user.id },
      kind: 'platform',
      content: { text: 'hi' },
    });

    expect(dispatched.map((d) => d.contactType).sort()).toEqual([
      ContactType.telegram,
      ContactType.whatsapp,
    ]);
  });

  it('skips contacts that do not accept the kind', async () => {
    const { entity: user } = await createUser();
    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.whatsapp,
        value: { jid: '222' },
        acceptedKinds: ['platform'],
      },
      { user },
    );
    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.telegram,
        value: { handle: '@two' },
        acceptedKinds: ['platform', 'marketing'],
      },
      { user },
    );

    await messageUser(worker, {
      rule: { field: 'id', operator: Operator.equals, value: user.id },
      kind: 'marketing',
      content: { text: 'promo' },
    });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].contactType).toBe(ContactType.telegram);
  });

  it('resolves multiple users via id IN and dispatches to each', async () => {
    const { entity: alice } = await createUser({ name: 'Alice' });
    const { entity: bob } = await createUser({ name: 'Bob' });

    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.whatsapp,
        value: { jid: 'a' },
        acceptedKinds: ['platform'],
      },
      { user: alice },
    );
    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.whatsapp,
        value: { jid: 'b' },
        acceptedKinds: ['platform'],
      },
      { user: bob },
    );

    await messageUser(worker, {
      rule: { field: 'id', operator: Operator.in, value: [alice.id, bob.id] },
      kind: 'platform',
      content: { text: 'hi' },
    });

    expect(dispatched).toHaveLength(2);
  });

  it('interpolates {{recipient.*}} and {{data.*}} per recipient', async () => {
    const { entity: alice } = await createUser({ name: 'Alice' });
    const { entity: bob } = await createUser({ name: 'Bob' });

    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.whatsapp,
        value: { jid: 'a' },
        acceptedKinds: ['platform'],
      },
      { user: alice },
    );
    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.whatsapp,
        value: { jid: 'b' },
        acceptedKinds: ['platform'],
      },
      { user: bob },
    );

    await messageUser(worker, {
      rule: { field: 'id', operator: Operator.in, value: [alice.id, bob.id] },
      kind: 'platform',
      content: { text: 'Hi {{recipient.name}} from {{data.sender}}', data: { sender: 'Tribe' } },
    });

    const texts = dispatched.map((d) => d.content.text).sort();
    expect(texts).toEqual(['Hi Alice from Tribe', 'Hi Bob from Tribe']);
  });

  it('always delivers system kind regardless of acceptedKinds', async () => {
    const { entity: user } = await createUser();
    await createContact(
      { ownerModel: 'User', type: ContactType.whatsapp, value: { jid: 'sys' }, acceptedKinds: [] },
      { user },
    );

    await messageUser(worker, {
      rule: { field: 'id', operator: Operator.equals, value: user.id },
      kind: 'system',
      content: { text: 'security alert' },
    });

    expect(dispatched).toHaveLength(1);
  });

  it('throws when a matched user has a contact type with no adapter', async () => {
    const { entity: user } = await createUser();
    await createContact(
      {
        ownerModel: 'User',
        type: ContactType.signal,
        value: { handle: '+1555' },
        acceptedKinds: ['platform'],
      },
      { user },
    );

    expect(
      messageUser(worker, {
        rule: { field: 'id', operator: Operator.equals, value: user.id },
        kind: 'platform',
        content: { text: 'hi' },
      }),
    ).rejects.toThrow(/No message provider adapter for contact.type=signal/);
  });

  it('no-ops when the rule matches no users', async () => {
    await messageUser(worker, {
      rule: {
        field: 'id',
        operator: Operator.equals,
        value: '00000000-0000-0000-0000-000000000000',
      },
      kind: 'platform',
      content: { text: 'hi' },
    });

    expect(dispatched).toHaveLength(0);
  });

  describe('renders through the recipient lens, as email does', () => {
    const memberships =
      '{{#each recipient.organizationUsers as=m}}[{{m.organization.name}}:{{m.role}}]{{/each}}';
    const isAdmin = JSON.stringify({
      field: 'recipient.organizationUsers',
      arrayOperator: 'any',
      condition: { field: 'role', operator: 'equals', value: 'admin' },
    });

    const member = async () => {
      const { entity: mine } = await createOrganization({ name: 'Mine' });
      const { entity: theirs } = await createOrganization({ name: 'Theirs' });
      const { entity: user } = await createUser({ name: 'Ada' });
      await createOrganizationUser({ role: 'admin' }, { user, organization: mine });
      await createOrganizationUser({ role: 'member' }, { user, organization: theirs });
      await createContact(
        { ownerModel: 'User', type: ContactType.whatsapp, value: { jid: user.id } },
        { user },
      );
      return { user, mine, theirs };
    };

    const send = async (userId: string, organizationId: string, text: string) => {
      await messageUser(worker, {
        rule: { field: 'id', operator: Operator.equals, value: userId },
        kind: 'system',
        content: { text },
        sender: { type: 'Organization', organizationId },
      });
      return dispatched.at(-1)?.content.text;
    };

    it("renders only the viewer projection: a hidden column and another organization's membership never print", async () => {
      const { user, mine } = await member();
      expect(
        await send(
          user.id,
          mine.id,
          `{{recipient.name}}|{{recipient.platformRole}}|${memberships}`,
        ),
      ).toBe('Ada||[Mine:admin]');
    });

    it("judges rules on the re-check rows the sender's lens keeps", async () => {
      const { user, mine, theirs } = await member();
      const text = `{{#if rule=${isAdmin}}}ADMIN{{else}}NOT{{/if}}`;
      expect(await send(user.id, mine.id, text)).toBe('ADMIN');
      expect(await send(user.id, theirs.id, text)).toBe('NOT');
    });

    it('renders the same content exactly as the email lane does for the same recipient', async () => {
      const { user, mine } = await member();
      const text = `Hi {{recipient.name}} ${memberships} {{#if rule=${isAdmin}}}ADMIN{{/if}}`;
      await saveEmailTemplate({
        slug: 'same-render',
        name: 'same-render',
        subject: 'Hi',
        kind: 'system',
        mjml: `<mjml><mj-body><mj-section><mj-column><mj-text>${text}</mj-text></mj-column></mj-section></mj-body></mjml>`,
        ownerModel: 'default',
      });
      const sender = { type: 'Organization', organizationId: mine.id } as const;
      const messaged = await send(user.id, mine.id, text);
      const emailed = await settleTemplate('same-render', sender, (lens) =>
        recipientVariables(lens, { recipientId: user.id, sender }),
      );
      expect(messaged).toBe('Hi Ada [Mine:admin] ADMIN');
      expect(emailed.mjml).toContain(`<mj-text>${messaged}</mj-text>`);
    });
  });
});
