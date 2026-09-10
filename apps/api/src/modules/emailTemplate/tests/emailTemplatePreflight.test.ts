import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createEmailTemplate, createUser } from '@template/db/test';
import { adminEmailTemplateRouter } from '#/modules/emailTemplate';
import { emailTemplatePreflight } from '#/modules/emailTemplate/services/emailTemplatePreflight';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const COMPLETE = [
  '<mjml><mj-head><mj-preview>Your week at a glance</mj-preview></mj-head><mj-body><mj-section><mj-column>',
  '<mj-image src="https://cdn.example/logo.png" alt="Acme" />',
  '<mj-text>Hello {{recipient.name}}</mj-text>',
  '<mj-text><a href="{{system.unsubscribeUrl}}">Unsubscribe</a></mj-text>',
  '</mj-column></mj-section></mj-body></mjml>',
].join('');

const SLOPPY = [
  '<mjml><mj-body><mj-section><mj-column>',
  '<mj-image src="https://cdn.example/hero.png" />',
  '<mj-text>ACT NOW {{recipient.nickname_that_does_not_exist}} — this is your last chance!!!</mj-text>',
  '</mj-column></mj-section></mj-body></mjml>',
].join('');

const RENDER_WARNING = COMPLETE.replace(
  'Hello {{recipient.name}}',
  '{{#each recipient.contacts as=c}}{{c.label}}{{/each}}',
);

type Body = {
  findings: { code: string; location?: string; message: string; severity: 'error' | 'warning' }[];
  summary: { errors: number; warnings: number };
  renderWarnings: string[];
};

describe('emailTemplatePreflight', () => {
  it('a complete draft comes back clean', async () => {
    const result = await emailTemplatePreflight({ mjml: COMPLETE, subject: 'Your weekly digest' });

    expect(result).toEqual({ findings: [], summary: { errors: 0, warnings: 0 }, renderWarnings: [] });
  });

  it('a sloppy draft without a slug reports unresolved tokens as warnings', async () => {
    const result = await emailTemplatePreflight({ mjml: SLOPPY });

    expect(result.findings.map((finding) => finding.code)).toEqual([
      'subject.missing',
      'preheader.missing',
      'unsubscribe.missing',
      'image.alt.missing',
      'token.unresolved',
      'spam.trigger',
      'spam.trigger',
    ]);
    expect(result.findings.find((finding) => finding.code === 'token.unresolved')?.location).toBe(
      'recipient.nickname_that_does_not_exist',
    );
    expect(result.findings.find((finding) => finding.code === 'token.unresolved')?.severity).toBe('warning');
    expect(result.findings.find((finding) => finding.code === 'image.alt.missing')?.location).toBe(
      'https://cdn.example/hero.png',
    );
    expect(result.summary).toEqual({ errors: 1, warnings: 6 });
  });

  it('turns render warnings from the sample render into error findings', async () => {
    const result = await emailTemplatePreflight({ mjml: RENDER_WARNING, subject: 'Your weekly digest' });

    expect(result.renderWarnings).toEqual(['{{#each recipient.contacts}} did not resolve to an array']);
    expect(result.findings.filter((finding) => finding.code === 'render.warning')).toEqual([
      {
        code: 'render.warning',
        severity: 'error',
        message: '{{#each recipient.contacts}} did not resolve to an array',
        location: 'mjml',
      },
    ]);
    expect(result.summary.errors).toBe(1);
  });

  it('resolves a data path against the rule surface of the slug it is given', async () => {
    await createEmailTemplate({
      slug: 'inquiry-digest',
      ownerModel: 'default',
      locale: 'en',
      lens: { data: { model: 'Inquiry', narrowing: { picks: ['content'] } } },
    });

    const result = await emailTemplatePreflight({
      mjml: COMPLETE.replace('Hello {{recipient.name}}', 'About {{data.content}} / {{data.notAColumn}}'),
      subject: 'Your weekly digest',
      slug: 'inquiry-digest',
    });

    expect(result.findings.map((finding) => [finding.code, finding.location])).toEqual([
      ['token.unresolved', 'data.notAColumn'],
    ]);
    expect(result.summary).toEqual({ errors: 1, warnings: 0 });
  });
});

describe('POST /api/admin/emailTemplate/preflight', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let superadmin: User;

  beforeAll(async () => {
    superadmin = (await createUser({ platformRole: PlatformRole.superadmin })).entity;
    const harness = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/admin/emailTemplate', adminEmailTemplateRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns the findings for the draft in the response envelope', async () => {
    const { data } = await json<Body>(
      await fetch(post('/api/admin/emailTemplate/preflight', { mjml: SLOPPY, subject: 'Digest' })),
    );

    expect(data.summary.errors).toBe(0);
    expect(data.findings.find((finding) => finding.code === 'token.unresolved')?.severity).toBe('warning');
  });

  it('rejects a body without mjml', async () => {
    const res = await fetch(post('/api/admin/emailTemplate/preflight', { subject: 'Digest' }));

    expect(res.status).toBe(400);
  });
});
