import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';

registerPreventHardDeleteHook();

const attempt = async (write: Promise<unknown>) => {
  try {
    await write;
    return undefined;
  } catch (error) {
    return String(error);
  }
};

describe('preventHardDelete hook', () => {
  afterAll(() => {
    clearHookRegistry();
  });

  it('refuses hard deletes on append-only history models', async () => {
    expect(await attempt(db.auditLog.deleteMany({ where: { id: 'no-such-id' } }))).toMatch(/append-only history/);
  });

  it('refuses hard deletes on soft-delete models', async () => {
    expect(await attempt(db.user.deleteMany({ where: { email: 'nobody@example.com' } }))).toMatch(/is soft-delete/);
  });
});
