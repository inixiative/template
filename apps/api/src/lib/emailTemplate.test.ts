import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, registerSoftDeleteScoper } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import { saveEmailTemplate } from '@template/email/render';
import { registerRulesHook } from '#/hooks/rules/hook';
import { settleTemplate } from '#/lib/emailTemplate';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';

const mjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column><mj-text>${content}</mj-text></mj-column></mj-section></mj-body></mjml>`;

const save = (slug: string, content: string, subject = 'Hello {{recipient.name}}') =>
  saveEmailTemplate({ slug, name: slug, subject, kind: 'system', mjml: mjml(content), ownerModel: 'default' });

const platform = { type: 'platform' } as const;
const variables = { recipient: { id: 'u1', name: 'Ada', email: 'ada@example.com' }, data: {} };

describe('settleTemplate — the registry entry decides what an issue does', () => {
  beforeAll(async () => {
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
    registerRulesHook();
    await save('clean', 'Hi {{recipient.name}}');
    await save('holey', 'Hi {{recipient.name}} {{data.missing}}');
    await save('bad-subject', 'Hi {{recipient.name}}', 'Code {{data.code}}');
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
    registerSoftDeleteScoper(null);
  });

  it('a clean render carries no issues', async () => {
    const settled = await settleTemplate('clean', platform, variables);
    expect(settled.slug).toBe('clean');
    expect(settled.issues).toEqual([]);
    expect(settled.mjml).toContain('Hi Ada');
  });

  it('fail is the default: a body issue refuses the send', async () => {
    await expect(settleTemplate('holey', platform, variables)).rejects.toBeInstanceOf(EmailRenderError);
  });

  it('degrade sends the body with the token empty and records the typed issue', async () => {
    const settled = await settleTemplate('holey', platform, variables, undefined, { onIssue: 'degrade' });
    expect(settled.mjml).toContain('Hi Ada ');
    expect(settled.mjml).not.toContain('{{');
    expect(settled.issues).toEqual([
      { kind: 'token', path: 'data.missing', detail: '{{data.missing}} resolved to nothing' },
    ]);
  });

  it('a subject issue is fatal even under degrade', async () => {
    await expect(settleTemplate('bad-subject', platform, variables, undefined, { onIssue: 'degrade' })).rejects.toThrow(
      /subject/,
    );
  });

  it("a substitute renders instead when the primary would fail, with the primary's variables", async () => {
    const settled = await settleTemplate('holey', platform, variables, undefined, {
      onIssue: 'fail',
      substitute: 'clean',
    });
    expect(settled.slug).toBe('clean');
    expect(settled.mjml).toContain('Hi Ada');
    expect(settled.issues).toEqual([]);
  });

  it('a substitute also covers a primary that cannot be composed at all', async () => {
    const settled = await settleTemplate('never-saved', platform, variables, undefined, {
      onIssue: 'fail',
      substitute: 'clean',
    });
    expect(settled.slug).toBe('clean');
  });

  it('a substitute that renders with issues fails the send rather than degrading silently', async () => {
    await expect(
      settleTemplate('never-saved', platform, variables, undefined, { onIssue: 'fail', substitute: 'holey' }),
    ).rejects.toBeInstanceOf(EmailRenderError);
  });
});
