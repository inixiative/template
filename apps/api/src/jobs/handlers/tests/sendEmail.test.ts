import { describe, expect, it, mock } from 'bun:test';
import { db } from '@template/db';
import type { WorkerContext } from '#/jobs/types';

const sendEmailSpy = mock(async () => {});

mock.module('@template/email/send', () => ({
  sendEmail: sendEmailSpy,
  emailRegistry: { register: () => {}, unregister: () => {}, names: () => [], has: () => false },
  setEmailVerifier: () => {},
  getEmailVerifier: () => ({ verify: async () => ({ email: '', status: 'deliverable' }) }),
  resolveFromAddress: async () => 'noreply@example.com',
}));

const { sendEmail } = await import('#/jobs/handlers/sendEmail');

describe('sendEmail handler (smoke)', () => {
  it('delegates to @template/email/send with ctx.db, payload, and ctx.log', async () => {
    sendEmailSpy.mockClear();

    const log = mock(() => {});
    const ctx = { db, log } as unknown as WorkerContext;

    const payload = {
      to: [{ raw: ['a@example.com'] }],
      template: 'smoke',
      data: { foo: 'bar' },
      tags: ['smoke'],
    };

    await sendEmail(ctx, payload);

    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    const call = sendEmailSpy.mock.calls[0];
    expect(call[0]).toBe(db);
    expect(call[1]).toEqual(payload);
    expect(call[2]).toBe(log);
  });
});
