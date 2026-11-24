import { describe, expect, it } from 'bun:test';
import { generateTotpCode } from '#/lib/twoFactor/totp/generateTotpCode';
import { generateTotpSetup } from '#/lib/twoFactor/totp/generateTotpSetup';
import { verifyTotpCode } from '#/lib/twoFactor/totp/verifyTotpCode';

describe('TOTP', () => {
  it('matches RFC 6238 SHA-1 test vectors', () => {
    const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(generateTotpCode(rfcSecret, 59_000)).toBe('287082');
    expect(generateTotpCode(rfcSecret, 1_111_111_109_000)).toBe('081804');
    expect(generateTotpCode(rfcSecret, 1_234_567_890_000)).toBe('005924');
  });

  it('builds a valid otpauth URI and accepts +/-1 step drift', async () => {
    const setup = generateTotpSetup({ issuer: 'Kingdom', accountName: 'user@example.com' });
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.otpauthUri).toContain('otpauth://totp/');
    expect(setup.otpauthUri).toContain(`secret=${setup.secret}`);

    const now = 1_700_000_000_000;
    await verifyTotpCode({
      secret: setup.secret,
      code: generateTotpCode(setup.secret, now),
      timestampMs: now,
    });
    await verifyTotpCode({
      secret: setup.secret,
      code: generateTotpCode(setup.secret, now - 30_000),
      timestampMs: now,
    });
    await expect(
      verifyTotpCode({
        secret: setup.secret,
        code: generateTotpCode(setup.secret, now - 90_000),
        timestampMs: now,
      }),
    ).rejects.toThrow('Invalid verification code');
  });
});
