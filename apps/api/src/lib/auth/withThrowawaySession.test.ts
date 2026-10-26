import { afterAll, describe, expect, it, spyOn } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { log } from '@template/shared/logger';
import { APIError } from 'better-auth/api';
import { auth } from '#/lib/auth';
import { withThrowawaySession } from '#/lib/auth/withThrowawaySession';
import { AppError } from '#/lib/errors';

afterAll(async () => {
  await cleanupTouchedTables(db);
});

const sessionsOf = async (userId: string) =>
  (await auth.$context).internalAdapter.listSessions(userId);

const presentedSession = (headers: Headers) => auth.api.getSession({ headers });

describe('withThrowawaySession', () => {
  it('hands Better Auth a session it accepts, and deletes it afterwards', async () => {
    const { entity: user } = await createUser();
    const seen = await withThrowawaySession(user.id, async (headers) => {
      const presented = await presentedSession(headers);
      expect(await sessionsOf(user.id)).toHaveLength(1);
      return presented?.user.id;
    });
    expect(seen).toBe(user.id);
    expect(await sessionsOf(user.id)).toEqual([]);
  });

  it('the session lives at most a minute', async () => {
    const { entity: user } = await createUser();
    await withThrowawaySession(user.id, async () => {
      const [session] = await sessionsOf(user.id);
      const secondsLeft = ((session?.expiresAt.getTime() ?? 0) - Date.now()) / 1000;
      expect(secondsLeft).toBeGreaterThan(50);
      expect(secondsLeft).toBeLessThanOrEqual(60);
    });
  });

  it('deletes the session when the call throws', async () => {
    const { entity: user } = await createUser();
    await expect(
      withThrowawaySession(user.id, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await sessionsOf(user.id)).toEqual([]);
  });

  it('a 401 inside the call means the throwaway was revoked: a 409 to retry, not a 401', async () => {
    const { entity: user } = await createUser();
    const thrown = await withThrowawaySession(user.id, async () => {
      throw new APIError('UNAUTHORIZED', { message: 'Unauthorized' });
    }).catch((error: unknown) => error);
    expect((thrown as AppError).status).toBe(409);
  });

  it('a 5xx from Better Auth becomes a plain 500 without its message', async () => {
    const { entity: user } = await createUser();
    const thrown = await withThrowawaySession(user.id, async () => {
      throw new APIError('INTERNAL_SERVER_ERROR', { message: 'adapter detail' });
    }).catch((error: unknown) => error);
    expect((thrown as AppError).status).toBe(500);
    expect((thrown as AppError).message).not.toContain('adapter detail');
  });

  it('turns a Better Auth APIError into an AppError with its status and message', async () => {
    const { entity: user } = await createUser();
    const thrown = await withThrowawaySession(user.id, async () => {
      throw new APIError('BAD_REQUEST', { message: 'Invalid password' });
    }).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).status).toBe(400);
    expect((thrown as AppError).message).toBe('Invalid password');
    expect(await sessionsOf(user.id)).toEqual([]);
  });

  it('concurrent calls for one user get their own sessions and leave none', async () => {
    const { entity: user } = await createUser();
    const tokens = await Promise.all(
      Array.from({ length: 5 }, () =>
        withThrowawaySession(user.id, async (headers) => {
          const presented = await presentedSession(headers);
          await Bun.sleep(20);
          expect((await presentedSession(headers))?.session.token).toBe(presented?.session.token);
          return presented?.session.token;
        }),
      ),
    );
    expect(new Set(tokens).size).toBe(5);
    expect(await sessionsOf(user.id)).toEqual([]);
  });

  it('never puts the session token in its result or a log line', async () => {
    const { entity: user } = await createUser();
    const lines: string[] = [];
    const record = (...args: unknown[]) => {
      lines.push(JSON.stringify(args));
    };
    const spies = [
      ...(['trace', 'debug', 'info', 'success', 'warn', 'error', 'fatal'] as const).map((level) =>
        spyOn(log, level).mockImplementation(record),
      ),
      ...(['log', 'debug', 'info', 'warn', 'error'] as const).map((level) =>
        spyOn(console, level).mockImplementation(record),
      ),
    ];
    let token = '';
    try {
      const result = await withThrowawaySession(user.id, async (headers) => {
        token = (await presentedSession(headers))?.session.token ?? '';
        return { ok: true };
      });
      expect(JSON.stringify(result)).not.toContain(token);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    expect(token).not.toBe('');
    expect(lines.join('\n')).not.toContain(token);
  });
});
