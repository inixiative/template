import { describe, expect, it } from 'bun:test';
import { generateBackupCodes } from '#/lib/twoFactor/totp/generateBackupCodes';
import { consumeMatchingBackupCode } from '#/lib/twoFactor/totp/matchBackupCode';

describe('backupCodes', () => {
  it('generates 10 formatted codes and verifies regardless of casing or separator', async () => {
    const { codes, hashes } = await generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const bareLower = codes[3]!.replaceAll('-', '').toLowerCase();
    const remaining = await consumeMatchingBackupCode(bareLower, hashes);
    expect(remaining).toHaveLength(9);
    expect(remaining).not.toContain(hashes[3]);

    await expect(consumeMatchingBackupCode('ZZZZ-ZZZZ-ZZZZ-ZZZZ', hashes)).rejects.toThrow(
      'Invalid backup code',
    );
  });
});
