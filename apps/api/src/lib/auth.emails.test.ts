import { afterAll, afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import { db, redisClient, redisNamespace } from '@template/db';
import { cleanupTouchedTables, createEmailTemplate, createUser } from '@template/db/test';
import type { SendEmailOptions } from '@template/email/client/types';
import { emitAppEvent } from '#/appEvents/emit';
import { appEventHandlers } from '#/appEvents/handlers';
import type { UserPasswordResetRequestedPayload } from '#/appEvents/handlers/user/userPasswordResetRequested';
import type { UserVerificationRequestedPayload } from '#/appEvents/handlers/user/userVerificationRequested';
import { auth } from '#/lib/auth';
import { emailRegistry, emailVerifier } from '#/lib/email';

const adapters = emailRegistry.names().map((name) => ({ name, client: emailRegistry.get(name) }));
const sent: SendEmailOptions[] = [];
const verificationEvent = spyOn(appEventHandlers, 'user.verificationRequested');
const passwordResetEvent = spyOn(appEventHandlers, 'user.passwordResetRequested');
const verifier = spyOn(emailVerifier, 'verify').mockImplementation(async (email) => ({
  email,
  status: 'deliverable',
}));

beforeEach(() => {
  for (const { name } of adapters) emailRegistry.unregister(name);
  emailRegistry.register('auth-email-recorder', {
    send: async (options) => {
      sent.push(options);
      return { id: 'auth-email-recorded', success: true };
    },
    sendBatch: async () => {
      throw new Error('Auth emails are sent one at a time');
    },
  });
});

afterEach(async () => {
  sent.length = 0;
  verificationEvent.mockClear();
  passwordResetEvent.mockClear();
  emailRegistry.unregister('auth-email-recorder');
  for (const { name, client } of adapters) emailRegistry.register(name, client);
  await cleanupTouchedTables(db);
});

afterAll(() => {
  verificationEvent.mockRestore();
  passwordResetEvent.mockRestore();
  verifier.mockRestore();
});

const createWelcomeTemplate = () =>
  createEmailTemplate({
    slug: 'welcome',
    subject: 'Welcome',
    kind: 'system',
    mjml: '<mjml><mj-body><mj-section><mj-column><mj-text>Welcome aboard</mj-text></mj-column></mj-section></mj-body></mjml>',
  });

test('signup delivers a verification email through app events and keeps the account unverified', async () => {
  await createEmailTemplate({
    slug: 'email-verification',
    subject: 'Verify your email',
    kind: 'system',
    mjml: '<mjml><mj-body><mj-section><mj-column><mj-text><a href="{{data.verificationUrl}}">Verify email</a></mj-text></mj-column></mj-section></mj-body></mjml>',
  });
  await createWelcomeTemplate();
  const email = `signup-${Bun.randomUUIDv7()}@example.com`;
  const password = 'synthetic-signup-password';
  const result = await auth.api.signUpEmail({ body: { name: 'Signup Test', email, password } });

  expect(result.token).toBeNull();
  expect(result.user.emailVerified).toBe(false);
  expect(verificationEvent).toHaveBeenCalledTimes(1);
  const event = verificationEvent.mock.calls[0][0];
  const data = event.data as UserVerificationRequestedPayload;
  expect(data.userId).toBe(result.user.id);
  const url = new URL(data.verificationUrl);
  expect(url.origin).toBe(new URL(process.env.API_URL!).origin);
  expect(url.pathname).toBe('/api/auth/verify-email');
  expect(url.searchParams.get('token')).toBeTruthy();
  const recordedEvent = await db.appEvent.findUniqueOrThrow({ where: { id: event.id } });
  expect(recordedEvent.data).toEqual({ userId: result.user.id, verificationUrl: '[MASKED]' });
  expect(JSON.stringify(recordedEvent.data)).not.toContain(url.searchParams.get('token')!);
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toBe(email);
  expect(sent[0].html).toContain(url.searchParams.get('token')!);
  const communication = await db.communicationLog.findFirst({ where: { address: email } });
  expect(communication?.status).toBe('sent');

  const signIn = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  expect(signIn.status).toBe(403);
  expect(((await signIn.json()) as { code: string }).code).toBe('EMAIL_NOT_VERIFIED');
});

test('verifying the email sends the welcome email, which signup alone does not', async () => {
  await createEmailTemplate({
    slug: 'email-verification',
    subject: 'Verify your email',
    kind: 'system',
    mjml: '<mjml><mj-body><mj-section><mj-column><mj-text><a href="{{data.verificationUrl}}">Verify email</a></mj-text></mj-column></mj-section></mj-body></mjml>',
  });
  await createWelcomeTemplate();
  const email = `welcome-${Bun.randomUUIDv7()}@example.com`;
  await auth.api.signUpEmail({
    body: { name: 'Welcome Test', email, password: 'synthetic-signup-password' },
  });
  expect(sent.map((message) => message.subject)).toEqual(['Verify your email']);

  const data = verificationEvent.mock.calls[0][0].data as UserVerificationRequestedPayload;
  const token = new URL(data.verificationUrl).searchParams.get('token')!;
  await auth.api.verifyEmail({ query: { token } });

  expect(sent.map((message) => message.subject)).toEqual(['Verify your email', 'Welcome']);
  expect(sent[1].to).toBe(email);
});

test('an account created already verified gets the welcome email at once', async () => {
  await createWelcomeTemplate();
  const email = `verified-${Bun.randomUUIDv7()}@example.com`;
  const context = await auth.$context;

  await context.internalAdapter.createUser(
    { name: 'Verified Test', email, emailVerified: true },
    { method: 'admin' },
  );

  expect(sent.map((message) => message.subject)).toEqual(['Welcome']);
  expect(sent[0].to).toBe(email);
});

test('a guest gets no welcome until the address is verified', async () => {
  await createWelcomeTemplate();
  const { entity: guest } = await createUser({
    email: `guest-${Bun.randomUUIDv7()}@example.com`,
    emailVerified: false,
  });

  await emitAppEvent('user.created', { userId: guest.id, isGuest: true });

  expect(sent).toHaveLength(0);
});

test('requesting a password reset delivers the reset link and masks it in the recorded event', async () => {
  await createEmailTemplate({
    slug: 'password-reset',
    subject: 'Reset your password',
    kind: 'system',
    mjml: '<mjml><mj-body><mj-section><mj-column><mj-text><a href="{{data.passwordResetUrl}}">Reset</a></mj-text></mj-column></mj-section></mj-body></mjml>',
  });
  const { entity: user } = await createUser({ email: `reset-${Bun.randomUUIDv7()}@example.com` });

  const redirectTo = new URL('/resetPassword', process.env.WEB_URL).toString();
  await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo } });

  expect(passwordResetEvent).toHaveBeenCalledTimes(1);
  const event = passwordResetEvent.mock.calls[0][0];
  const data = event.data as UserPasswordResetRequestedPayload;
  expect(data.userId).toBe(user.id);
  const url = new URL(data.passwordResetUrl);
  expect(url.pathname).toMatch(/^\/api\/auth\/reset-password\/[^/]+$/);
  expect(url.searchParams.get('callbackURL')).toBe(redirectTo);
  const token = url.pathname.split('/').at(-1)!;
  const landing = await auth.handler(new Request(url.toString()));
  expect(landing.status).toBe(302);
  expect(landing.headers.get('location')).toBe(`${redirectTo}?token=${token}`);
  const recordedEvent = await db.appEvent.findUniqueOrThrow({ where: { id: event.id } });
  expect(recordedEvent.data).toEqual({ userId: user.id, passwordResetUrl: '[MASKED]' });
  expect(JSON.stringify(recordedEvent.data)).not.toContain(token);
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toBe(user.email);
  expect(sent[0].html).toContain(token);

  const lifetimeSeconds = await redisClient().ttl(
    `${redisNamespace.session}:verification:reset-password:${token}`,
  );
  expect(lifetimeSeconds).toBeGreaterThan(55 * 60);
  expect(lifetimeSeconds).toBeLessThanOrEqual(60 * 60);

  const newPassword = 'synthetic-reset-password';
  await auth.api.resetPassword({ body: { token, newPassword } });
  const signIn = await auth.api.signInEmail({
    body: { email: user.email, password: newPassword },
    asResponse: true,
  });
  expect(signIn.status).toBe(200);
});

test('resetting replaces the password of an account that already has one', async () => {
  await createEmailTemplate({
    slug: 'password-reset',
    subject: 'Reset your password',
    kind: 'system',
    mjml: '<mjml><mj-body><mj-section><mj-column><mj-text><a href="{{data.passwordResetUrl}}">Reset</a></mj-text></mj-column></mj-section></mj-body></mjml>',
  });
  const email = `existing-password-${Bun.randomUUIDv7()}@example.com`;
  const oldPassword = 'synthetic-original-password';
  const { user } = await auth.api.signUpEmail({
    body: { name: 'Reset Test', email, password: oldPassword },
  });
  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  await auth.api.requestPasswordReset({ body: { email } });
  const data = passwordResetEvent.mock.calls[0][0].data as UserPasswordResetRequestedPayload;
  const token = new URL(data.passwordResetUrl).pathname.split('/').at(-1)!;
  const newPassword = 'synthetic-replacement-password';
  await auth.api.resetPassword({ body: { token, newPassword } });

  const withNew = await auth.api.signInEmail({
    body: { email, password: newPassword },
    asResponse: true,
  });
  expect(withNew.status).toBe(200);
  const withOld = await auth.api.signInEmail({
    body: { email, password: oldPassword },
    asResponse: true,
  });
  expect(withOld.status).toBe(401);
  expect(await db.account.count({ where: { userId: user.id, providerId: 'credential' } })).toBe(1);
});

test('requesting a reset for an unknown address sends nothing', async () => {
  await auth.api.requestPasswordReset({
    body: { email: `nobody-${Bun.randomUUIDv7()}@example.com` },
  });

  expect(passwordResetEvent).not.toHaveBeenCalled();
  expect(sent).toHaveLength(0);
});
