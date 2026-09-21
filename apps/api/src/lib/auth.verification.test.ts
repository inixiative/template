import { afterAll, beforeAll, expect, spyOn, test } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createEmailTemplate, registerTestTracker } from '@template/db/test';
import type { SendEmailOptions } from '@template/email/client/types';
import { appEventHandlers } from '#/appEvents/handlers';
import type { UserVerificationRequestedPayload } from '#/appEvents/handlers/user/userVerificationRequested';
import { auth } from '#/lib/auth';
import { emailRegistry, emailVerifier } from '#/lib/email';

const adapters = emailRegistry.names().map((name) => ({ name, client: emailRegistry.get(name) }));
const sent: SendEmailOptions[] = [];
const verificationEvent = spyOn(appEventHandlers, 'user.verificationRequested');
const verifier = spyOn(emailVerifier, 'verify').mockImplementation(async (email) => ({ email, status: 'deliverable' }));

beforeAll(() => {
  registerTestTracker();
  for (const { name } of adapters) emailRegistry.unregister(name);
  emailRegistry.register('signup-recorder', {
    send: async (options) => {
      sent.push(options);
      return { id: 'signup-recorded', success: true };
    },
    sendBatch: async () => {
      throw new Error('Signup should send a single verification email');
    },
  });
});

afterAll(async () => {
  verificationEvent.mockRestore();
  verifier.mockRestore();
  emailRegistry.unregister('signup-recorder');
  for (const { name, client } of adapters) emailRegistry.register(name, client);
  await cleanupTouchedTables(db);
});

test('signup delivers a verification email through app events and keeps the account unverified', async () => {
  await createEmailTemplate({
    slug: 'email-verification',
    subject: 'Verify your email',
    kind: 'system',
    mjml: '<mjml><mj-body><mj-section><mj-column><mj-text><a href="{{data.verificationUrl}}">Verify email</a></mj-text></mj-column></mj-section></mj-body></mjml>',
  });
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
  expect(recordedEvent.data).toEqual({ userId: result.user.id, verificationUrl: '[REDACTED]' });
  expect(JSON.stringify(recordedEvent.data)).not.toContain(url.searchParams.get('token')!);
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toBe(email);
  expect(sent[0].html).toContain(url.searchParams.get('token')!);
  const communication = await db.communicationLog.findFirst({ where: { address: email } });
  expect(communication?.status).toBe('sent');

  const signIn = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  expect(signIn.status).toBe(403);
  expect((await signIn.json()).code).toBe('EMAIL_NOT_VERIFIED');
});
