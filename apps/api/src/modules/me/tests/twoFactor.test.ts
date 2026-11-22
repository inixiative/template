import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { db, redisClient, redisNamespace } from '@template/db';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import {
  TWO_FACTOR_ENROLLMENT_REQUIRED_CODE,
  TWO_FACTOR_REVERIFY_REQUIRED_CODE,
  TWO_FACTOR_VERIFICATION_REQUIRED_CODE,
} from '@template/shared/auth/twoFactor';
import { resetEnvOverrides, setEnvOverride } from '@template/shared/utils';
import { setRequestCookie } from 'better-auth/cookies';
import { makeSignature } from 'better-auth/crypto';
import { app } from '#/app';
import { auth } from '#/lib/auth';
import { PRE_TWO_FACTOR_JWT_TTL_SECONDS, USER_JWT_TTL_SECONDS } from '#/lib/auth/userJwt';
import { verifyIssuerJwt } from '#/lib/auth/verifyIssuerJwt';
import { generateTotpCode } from '#/lib/twoFactor/totp/generateTotpCode';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

const ORIGIN = process.env.WEB_URL || 'http://localhost:3100';
const RP_ID = new URL(ORIGIN).hostname;

const cborUint = (major: number, value: number): Buffer => {
  const prefix = major << 5;
  if (value < 24) return Buffer.from([prefix | value]);
  if (value < 0x100) return Buffer.from([prefix | 24, value]);
  const buf = Buffer.alloc(3);
  buf[0] = prefix | 25;
  buf.writeUInt16BE(value, 1);
  return buf;
};

const cborNegInt = (value: number): Buffer => cborUint(1, -1 - value);
const cborBytes = (bytes: Buffer): Buffer => Buffer.concat([cborUint(2, bytes.length), bytes]);
const cborText = (str: string): Buffer => {
  const bytes = Buffer.from(str, 'utf8');
  return Buffer.concat([cborUint(3, bytes.length), bytes]);
};

const createSimulatedAuthenticator = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');
  const credentialIdBuf = randomBytes(32);
  const credentialId = credentialIdBuf.toString('base64url');
  let signCount = 0;

  const cosePublicKey = Buffer.concat([
    cborUint(5, 5),
    cborUint(0, 1),
    cborUint(0, 2),
    cborUint(0, 3),
    cborNegInt(-7),
    cborNegInt(-1),
    cborUint(0, 1),
    cborNegInt(-2),
    cborBytes(x),
    cborNegInt(-3),
    cborBytes(y),
  ]);

  const register = (challenge: string, rpId = RP_ID, origin = ORIGIN) => {
    const clientDataJSON = Buffer.from(
      JSON.stringify({ type: 'webauthn.create', challenge, origin, crossOrigin: false }),
      'utf8',
    );
    const rpIdHash = createHash('sha256').update(rpId).digest();
    const flags = Buffer.from([0x45]);
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(signCount, 0);
    const aaguid = Buffer.alloc(16, 0);
    const credLenBuf = Buffer.alloc(2);
    credLenBuf.writeUInt16BE(credentialIdBuf.length, 0);
    const authData = Buffer.concat([
      rpIdHash,
      flags,
      counterBuf,
      aaguid,
      credLenBuf,
      credentialIdBuf,
      cosePublicKey,
    ]);
    const attestationObject = Buffer.concat([
      cborUint(5, 3),
      cborText('fmt'),
      cborText('none'),
      cborText('attStmt'),
      cborUint(5, 0),
      cborText('authData'),
      cborBytes(authData),
    ]);

    return {
      id: credentialId,
      rawId: credentialId,
      type: 'public-key' as const,
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        attestationObject: attestationObject.toString('base64url'),
        transports: ['internal'],
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  };

  const authenticate = (challenge: string, rpId = RP_ID, origin = ORIGIN) => {
    signCount += 1;
    const clientDataJSON = Buffer.from(
      JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }),
      'utf8',
    );
    const rpIdHash = createHash('sha256').update(rpId).digest();
    const flags = Buffer.from([0x05]);
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(signCount, 0);
    const authData = Buffer.concat([rpIdHash, flags, counterBuf]);
    const clientDataHash = createHash('sha256').update(clientDataJSON).digest();
    const signature = sign('sha256', Buffer.concat([authData, clientDataHash]), privateKey);

    return {
      id: credentialId,
      rawId: credentialId,
      type: 'public-key' as const,
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        authenticatorData: authData.toString('base64url'),
        signature: signature.toString('base64url'),
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  };

  return { credentialId, register, authenticate };
};

const createSignedUpEmailUser = async () => {
  const email = `2fa-${Bun.randomUUIDv7()}@example.com`;
  const password = 'TwoFactor-Test-Password-123!';
  const { user } = await auth.api.signUpEmail({
    body: { name: 'TwoFactor User', email, password },
  });
  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  const reloaded = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  return { user: reloaded, email, password };
};

const clearAuthRedisKeys = async () => {
  const patterns = [
    `${redisNamespace.limit}:auth:*`,
    `${redisNamespace.limit}:credentialChange:*`,
    `${redisNamespace.limit}:twoFactor:*`,
    `${redisNamespace.otp}:*`,
  ];
  for (const pattern of patterns) {
    const keys = await redisClient().keys(pattern);
    if (keys.length) await redisClient().del(...keys);
  }
};

beforeEach(async () => {
  setEnvOverride('REQUIRE_TWO_FACTOR', 'false');
  await clearAuthRedisKeys();
});

afterEach(async () => {
  resetEnvOverrides();
  await clearAuthRedisKeys();
  await cleanupTouchedTables(db);
});

describe('two-factor authentication', () => {
  it('enrolls TOTP with password check, encrypts pending secret, issues 15-min pre-2FA JWT, locks enroll routes, and upgrades via TOTP or 80-bit backup code', async () => {
    const { user, email, password } = await createSignedUpEmailUser();
    const jwt = await createUserJwt(user);

    const missingPw = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...jwt, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(missingPw.status).toBe(400);

    const wrongPw = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...jwt, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'wrong-password' }),
    });
    expect(wrongPw.status).toBe(400);

    const startRes = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...jwt, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: password }),
    });
    expect(startRes.status).toBe(200);
    const { data: started } = (await startRes.json()) as {
      data: { secret: string; otpauthUri: string };
    };
    expect(started.otpauthUri).toContain('otpauth://totp/');
    const storedPending = await redisClient().get(`${redisNamespace.otp}:totp-setup:${user.id}`);
    expect(storedPending).toBeTruthy();
    expect(storedPending).not.toContain(started.secret);

    const initialCode = generateTotpCode(started.secret, Date.now() - 30_000);
    const confirmRes = await app.request('/api/v1/me/twoFactor/totp/confirm', {
      method: 'POST',
      headers: { ...jwt, 'content-type': 'application/json' },
      body: JSON.stringify({ code: initialCode }),
    });
    expect(confirmRes.status).toBe(200);
    const { data: confirmed } = (await confirmRes.json()) as {
      data: { enabled: boolean; backupCodes: string[]; jwt?: { token: string; expiresAt: string } };
    };
    expect(confirmed.enabled).toBe(true);
    expect(confirmed.backupCodes).toHaveLength(10);
    expect(confirmed.backupCodes[0]).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const confirmedClaims = await verifyIssuerJwt(confirmed.jwt!.token);
    expect(confirmedClaims.twoFactor).toBe(true);
    expect((confirmedClaims.exp ?? 0) - (confirmedClaims.iat ?? 0)).toBe(USER_JWT_TTL_SECONDS);
    expect(confirmedClaims.twoFactorVerifiedAt).toBe(confirmedClaims.iat);

    const signInRes = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email, password }),
    });
    expect(signInRes.status).toBe(200);
    const preHandoff = (await signInRes.json()) as { token: string };
    const preClaims = await verifyIssuerJwt(preHandoff.token);
    expect(preClaims.sub).toBe(user.id);
    expect(preClaims.twoFactor).toBeUndefined();
    expect((preClaims.exp ?? 0) - (preClaims.iat ?? 0)).toBe(PRE_TWO_FACTOR_JWT_TTL_SECONDS);
    const preJwt = { authorization: `Bearer ${preHandoff.token}` };
    const authCtx = await auth.$context;
    expect(await authCtx.internalAdapter.listSessions(user.id)).toEqual([]);

    for (const [path, body] of [
      ['/api/v1/me/twoFactor/totp/start', { currentPassword: password }],
      ['/api/v1/me/twoFactor/totp/confirm', { code: '123456' }],
      ['/api/v1/me/twoFactor/passkey/options', { currentPassword: password }],
      [
        '/api/v1/me/twoFactor/passkey/confirm',
        { name: 'Key', response: { id: 'x', rawId: 'x', type: 'public-key', response: {} } },
      ],
      ['/api/v1/me/twoFactor/totp/disable', undefined],
      ['/api/v1/me/twoFactor/backupCodes/regenerate', undefined],
    ] as const) {
      const blocked = await app.request(path, {
        method: 'POST',
        headers: { ...preJwt, 'content-type': 'application/json', origin: ORIGIN },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      expect(blocked.status).toBe(403);
      const blockedBody = (await blocked.json()) as { details?: Array<{ code?: string }> };
      expect(blockedBody.details?.[0]?.code).toBe(TWO_FACTOR_VERIFICATION_REQUIRED_CODE);
    }

    const replay = await app.request('/api/v1/me/twoFactor/verify', {
      method: 'POST',
      headers: { ...preJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ method: 'totp', code: initialCode }),
    });
    expect(replay.status).toBe(401);

    const liveCode = generateTotpCode(started.secret, Date.now());
    const verifyRes = await app.request('/api/v1/me/twoFactor/verify', {
      method: 'POST',
      headers: { ...preJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ method: 'totp', code: liveCode }),
    });
    expect(verifyRes.status).toBe(200);
    const { data: upgraded } = (await verifyRes.json()) as {
      data: { jwt?: { token: string; expiresAt: string } };
    };
    const verifiedClaims = await verifyIssuerJwt(upgraded.jwt!.token);
    expect(verifiedClaims.sub).toBe(user.id);
    expect(verifiedClaims.twoFactor).toBe(true);
    expect((verifiedClaims.exp ?? 0) - (verifiedClaims.iat ?? 0)).toBe(USER_JWT_TTL_SECONDS);
    expect(verifiedClaims.twoFactorVerifiedAt).toBe(verifiedClaims.iat);

    const backupCode = confirmed.backupCodes[0]!;
    const backupRes = await app.request('/api/v1/me/twoFactor/verify', {
      method: 'POST',
      headers: { ...preJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ method: 'backupCode', code: backupCode }),
    });
    expect(backupRes.status).toBe(200);

    const reusedBackup = await app.request('/api/v1/me/twoFactor/verify', {
      method: 'POST',
      headers: { ...preJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ method: 'backupCode', code: backupCode }),
    });
    expect(reusedBackup.status).toBe(401);
  });

  it('enforces mandatory enrollment, redacts pre-2FA /me rosters, blocks stale twoFactor JWTs, and refuses removing last factor', async () => {
    setEnvOverride('REQUIRE_TWO_FACTOR', 'true');
    const { user, email, password } = await createSignedUpEmailUser();
    const { entity: org } = await createOrganization();
    await createOrganizationUser({ userId: user.id, organizationId: org.id });

    const signInRes = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email, password }),
    });
    expect(signInRes.status).toBe(200);
    const preHandoff = (await signInRes.json()) as { token: string };
    const preTwoFactorJwt = { authorization: `Bearer ${preHandoff.token}` };

    const meBeforeEnroll = await app.request('/api/v1/me', { headers: { ...preTwoFactorJwt } });
    expect(meBeforeEnroll.status).toBe(200);
    const meBeforeBody = (await meBeforeEnroll.json()) as {
      data: { twoFactorAction: string | null; organizations: unknown[] };
    };
    expect(meBeforeBody.data.twoFactorAction).toBe('enroll');
    expect(meBeforeBody.data.organizations).toEqual([]);

    const staleClaimedJwt = await createUserJwt(user, { twoFactor: true });
    const staleClaimedBlocked = await app.request('/api/v1/me/tokens', {
      headers: { ...staleClaimedJwt },
    });
    expect(staleClaimedBlocked.status).toBe(403);
    expect(
      ((await staleClaimedBlocked.json()) as { details?: Array<{ code?: string }> }).details?.[0]
        ?.code,
    ).toBe(TWO_FACTOR_ENROLLMENT_REQUIRED_CODE);

    const cliBlocked = await app.request('/api/v1/me/tokens', { headers: { ...preTwoFactorJwt } });
    expect(cliBlocked.status).toBe(403);
    expect(
      ((await cliBlocked.json()) as { details?: Array<{ code?: string }> }).details?.[0]?.code,
    ).toBe(TWO_FACTOR_ENROLLMENT_REQUIRED_CODE);

    const verifyTwoFactorBeforeEnroll = await app.request('/api/v1/me/twoFactor/verify', {
      method: 'POST',
      headers: { ...preTwoFactorJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'totp', code: '123456' }),
    });
    expect(verifyTwoFactorBeforeEnroll.status).toBe(403);

    const startRes = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...preTwoFactorJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ currentPassword: password }),
    });
    expect(startRes.status).toBe(200);
    const { data: started } = (await startRes.json()) as { data: { secret: string } };

    const confirmRes = await app.request('/api/v1/me/twoFactor/totp/confirm', {
      method: 'POST',
      headers: { ...preTwoFactorJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ code: generateTotpCode(started.secret, Date.now() - 30_000) }),
    });
    expect(confirmRes.status).toBe(200);
    const { data: enrolled } = (await confirmRes.json()) as {
      data: { jwt?: { token: string } };
    };
    const verifiedJwt = { authorization: `Bearer ${enrolled.jwt!.token}` };

    const enrollBlockedNow = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...preTwoFactorJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: password }),
    });
    expect(enrollBlockedNow.status).toBe(403);
    expect(
      ((await enrollBlockedNow.json()) as { details?: Array<{ code?: string }> }).details?.[0]
        ?.code,
    ).toBe(TWO_FACTOR_VERIFICATION_REQUIRED_CODE);

    const meAfterEnroll = await app.request('/api/v1/me', { headers: verifiedJwt });
    const meAfterBody = (await meAfterEnroll.json()) as {
      data: { twoFactorAction: string | null; organizations: unknown[] };
    };
    expect(meAfterBody.data.twoFactorAction).toBeNull();
    expect(meAfterBody.data.organizations).toHaveLength(1);

    const disableRes = await app.request('/api/v1/me/twoFactor/totp/disable', {
      method: 'POST',
      headers: verifiedJwt,
    });
    expect(disableRes.status).toBe(422);
  });

  it('registers, authenticates, renames, and deletes a passkey under /me/twoFactor/passkey and enforces re-verification on token create/escalation', async () => {
    const { entity: oauthOnlyUser } = await createUser();
    const initialJwt = await createUserJwt(oauthOnlyUser);
    const authenticator = createSimulatedAuthenticator();

    const optionsRes = await app.request('/api/v1/me/twoFactor/passkey/options', {
      method: 'POST',
      headers: { ...initialJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({}),
    });
    expect(optionsRes.status).toBe(200);
    const { data: optsData } = (await optionsRes.json()) as {
      data: { options: { challenge: string }; rpId: string };
    };

    const confirmRes = await app.request('/api/v1/me/twoFactor/passkey/confirm', {
      method: 'POST',
      headers: { ...initialJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({
        name: 'MacBook Touch ID',
        response: authenticator.register(optsData.options.challenge, optsData.rpId, ORIGIN),
      }),
    });
    expect(confirmRes.status).toBe(200);
    const { data: created } = (await confirmRes.json()) as {
      data: { passkey: { id: string; name: string }; jwt?: { token: string } };
    };
    expect(created.passkey.name).toBe('MacBook Touch ID');

    const reloaded = await db.user.findUniqueOrThrow({ where: { id: oauthOnlyUser.id } });
    const nonRecentJwt = await createUserJwt(reloaded, { twoFactor: true });

    const renameRes = await app.request('/api/v1/me/twoFactor/passkey/rename', {
      method: 'POST',
      headers: { ...nonRecentJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ passkeyId: created.passkey.id, name: 'Work MacBook' }),
    });
    expect(renameRes.status).toBe(200);

    const { authorization } = await createBearerToken(reloaded);
    expect((await app.request('/api/v1/me/twoFactor', { headers: { authorization } })).status).toBe(
      403,
    );

    const blockedToken = await app.request('/api/v1/me/tokens', {
      method: 'POST',
      headers: { ...nonRecentJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ name: 'CI Token' }),
    });
    expect(blockedToken.status).toBe(403);
    const blockedBody = (await blockedToken.json()) as {
      details?: Array<{ code?: string; methods?: string[] }>;
    };
    expect(blockedBody.details?.[0]?.code).toBe(TWO_FACTOR_REVERIFY_REQUIRED_CODE);
    expect(blockedBody.details?.[0]?.methods).toContain('passkey');

    // Passkey-only user with 0 backup codes still fails closed on a mismatched Origin (no fail-open).
    await db.twoFactor.update({
      where: { userId: oauthOnlyUser.id },
      data: { backupCodeHashes: [] },
    });
    const crossOriginBlocked = await app.request('/api/v1/me/tokens', {
      method: 'POST',
      headers: {
        ...nonRecentJwt,
        'content-type': 'application/json',
        origin: 'https://other.example.com',
      },
      body: JSON.stringify({ name: 'Cross-Origin Token' }),
    });
    expect(crossOriginBlocked.status).toBe(403);

    const verifyTwoFactorOptsRes = await app.request(
      '/api/v1/me/twoFactor/verify/passkey/options',
      {
        method: 'POST',
        headers: { ...nonRecentJwt, origin: ORIGIN },
      },
    );
    expect(verifyTwoFactorOptsRes.status).toBe(200);
    const { data: verifyTwoFactorOpts } = (await verifyTwoFactorOptsRes.json()) as {
      data: { options: { challenge: string }; rpId: string };
    };
    const verifyTwoFactorVerifyRes = await app.request('/api/v1/me/twoFactor/verify', {
      method: 'POST',
      headers: { ...nonRecentJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({
        method: 'passkey',
        response: authenticator.authenticate(
          verifyTwoFactorOpts.options.challenge,
          verifyTwoFactorOpts.rpId,
          ORIGIN,
        ),
      }),
    });
    expect(verifyTwoFactorVerifyRes.status).toBe(200);
    const { data: verifyTwoFactor } = (await verifyTwoFactorVerifyRes.json()) as {
      data: { jwt?: { token: string } };
    };
    const verifyTwoFactorJwt = { authorization: `Bearer ${verifyTwoFactor.jwt!.token}` };

    const allowedToken = await app.request('/api/v1/me/tokens', {
      method: 'POST',
      headers: { ...verifyTwoFactorJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ name: 'CI Token' }),
    });
    expect(allowedToken.status).toBe(201);
    const { data: mintedToken } = (await allowedToken.json()) as { data: { id: string } };

    const escalateBlocked = await app.request(`/api/v1/token/${mintedToken.id}`, {
      method: 'PATCH',
      headers: { ...nonRecentJwt, 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ full: true }),
    });
    expect(escalateBlocked.status).toBe(403);

    const deleteRes = await app.request('/api/v1/me/twoFactor/passkey/delete', {
      method: 'POST',
      headers: { ...verifyTwoFactorJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ passkeyId: created.passkey.id }),
    });
    expect(deleteRes.status).toBe(204);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: oauthOnlyUser.id } })).twoFactorEnabled,
    ).toBe(false);
    expect((await app.request('/api/v1/me', { headers: verifyTwoFactorJwt })).status).toBe(401);
  });

  it('blocks superadmin API tokens from bypassing 2FA/re-verification, enforces superadmin re-verification on resetTwoFactor, clears pending Redis keys, and throttles 429', async () => {
    const { entity: target } = await createUser();
    const { entity: admin } = await createUser({ platformRole: PlatformRole.superadmin });
    const targetJwt = await createUserJwt(target);
    const adminInitialJwt = await createUserJwt(admin);

    const adminStart = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...adminInitialJwt, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { data: adminTotp } = (await adminStart.json()) as { data: { secret: string } };
    const adminConfirm = await app.request('/api/v1/me/twoFactor/totp/confirm', {
      method: 'POST',
      headers: { ...adminInitialJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ code: generateTotpCode(adminTotp.secret, Date.now() - 30_000) }),
    });
    const { data: adminConfirmed } = (await adminConfirm.json()) as {
      data: { jwt: { token: string } };
    };
    const adminRecentJwt = { authorization: `Bearer ${adminConfirmed.jwt.token}` };
    const reloadedAdmin = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    const adminNonRecentJwt = await createUserJwt(reloadedAdmin, { twoFactor: true });

    const { authorization: adminApiToken } = await createBearerToken(reloadedAdmin);
    expect(
      (await app.request('/api/v1/me/twoFactor', { headers: { authorization: adminApiToken } }))
        .status,
    ).toBe(403);
    expect(
      (
        await app.request('/api/v1/me/tokens', {
          method: 'POST',
          headers: { authorization: adminApiToken, 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Escalated', full: true }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(`/api/admin/user/${target.id}/resetTwoFactor`, {
          method: 'POST',
          headers: { authorization: adminApiToken },
        })
      ).status,
    ).toBe(403);

    const startRes = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...targetJwt, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(startRes.status).toBe(200);
    expect(await redisClient().get(`${redisNamespace.otp}:totp-setup:${target.id}`)).toBeTruthy();

    expect(
      (
        await app.request(`/api/admin/user/${target.id}/resetTwoFactor`, {
          method: 'POST',
          headers: { ...adminNonRecentJwt },
        })
      ).status,
    ).toBe(403);

    const resetRes = await app.request(`/api/admin/user/${target.id}/resetTwoFactor`, {
      method: 'POST',
      headers: adminRecentJwt,
    });
    expect(resetRes.status).toBe(204);
    expect(await redisClient().get(`${redisNamespace.otp}:totp-setup:${target.id}`)).toBeNull();
    expect((await app.request('/api/v1/me', { headers: { ...targetJwt } })).status).toBe(401);

    const afterReset = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    const freshJwt = await createUserJwt(afterReset);
    const start2 = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...freshJwt, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { data: started2 } = (await start2.json()) as { data: { secret: string } };
    const confirm2 = await app.request('/api/v1/me/twoFactor/totp/confirm', {
      method: 'POST',
      headers: { ...freshJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ code: generateTotpCode(started2.secret, Date.now() - 30_000) }),
    });
    const { data: c2 } = (await confirm2.json()) as { data: { jwt: { token: string } } };
    const reloadedTarget = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    const targetNonRecentJwt = await createUserJwt(reloadedTarget, { twoFactor: true });

    expect(
      (await app.request('/api/v1/me/redact', { method: 'POST', headers: targetNonRecentJwt }))
        .status,
    ).toBe(403);
    expect(
      (
        await app.request('/api/v1/me/redact', {
          method: 'POST',
          headers: { authorization: `Bearer ${c2.jwt.token}` },
        })
      ).status,
    ).toBe(204);

    const scrubbed = await db.withDeleted(() =>
      db.twoFactor.findUnique({ where: { userId: target.id } }),
    );
    expect(scrubbed?.deletedAt).not.toBeNull();
    expect(scrubbed?.encryptedTotpSecret).toBeNull();

    const { entity: throttledUser } = await createUser();
    const throttledJwt = await createUserJwt(throttledUser);
    let got429 = false;
    for (let i = 0; i < 12; i += 1) {
      const res = await app.request('/api/v1/me/twoFactor/verify', {
        method: 'POST',
        headers: { ...throttledJwt, 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ method: 'totp', code: '000000' }),
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }
    expect(got429).toBe(true);
  });

  it('issues 15-min pre-2FA JWT on OAuth OTT sign-in, invalidates on rotateUserJwts, and rotates JWTs on User revive', async () => {
    const { entity: oauthUser } = await createUser();
    setEnvOverride('REQUIRE_TWO_FACTOR', 'true');

    const authCtx = await auth.$context;
    const ottSession = await authCtx.internalAdapter.createSession(
      oauthUser.id,
      false,
      undefined,
      true,
    );
    const ottHeaders = new Headers();
    const signature = await makeSignature(ottSession.token, authCtx.secret);
    setRequestCookie(
      ottHeaders,
      authCtx.authCookies.sessionToken.name,
      `${ottSession.token}.${signature}`,
    );
    const { token: enrollOtt } = await auth.api.generateOneTimeToken({ headers: ottHeaders });
    const ottEnrollRes = await app.request('/api/auth/one-time-token/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ token: enrollOtt }),
    });
    expect(ottEnrollRes.status).toBe(200);
    const ottHandoff = (await ottEnrollRes.json()) as { token: string };
    const ottClaims = await verifyIssuerJwt(ottHandoff.token);
    expect(ottClaims.sub).toBe(oauthUser.id);
    expect(ottClaims.twoFactor).toBeUndefined();
    expect((ottClaims.exp ?? 0) - (ottClaims.iat ?? 0)).toBe(PRE_TWO_FACTOR_JWT_TTL_SECONDS);

    await rotateUserJwts(oauthUser.id);
    const staleEnroll = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ottHandoff.token}`,
        'content-type': 'application/json',
        origin: ORIGIN,
      },
      body: JSON.stringify({}),
    });
    expect(staleEnroll.status).toBe(401);

    setEnvOverride('REQUIRE_TWO_FACTOR', 'false');
    const refreshedUser = await db.user.findUniqueOrThrow({ where: { id: oauthUser.id } });
    const freshJwt = await createUserJwt(refreshedUser);
    const start1 = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...freshJwt, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { data: s1 } = (await start1.json()) as { data: { secret: string } };
    const confirm1 = await app.request('/api/v1/me/twoFactor/totp/confirm', {
      method: 'POST',
      headers: { ...freshJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ code: generateTotpCode(s1.secret, Date.now() - 30_000) }),
    });
    expect(confirm1.status).toBe(200);
    const { data: c1 } = (await confirm1.json()) as { data: { jwt: { token: string } } };

    await db.user.update({ where: { id: oauthUser.id }, data: { deletedAt: new Date() } });
    await db.withDeleted(() =>
      db.user.update({ where: { id: oauthUser.id }, data: { deletedAt: null } }),
    );
    const revived = await db.user.findUniqueOrThrow({ where: { id: oauthUser.id } });
    expect(revived.twoFactorEnabled).toBe(false);
    expect(
      (await app.request('/api/v1/me', { headers: { authorization: `Bearer ${c1.jwt.token}` } }))
        .status,
    ).toBe(401);

    const revivedJwt = await createUserJwt(revived);
    const start2 = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...revivedJwt, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(start2.status).toBe(200);
    const { data: s2 } = (await start2.json()) as { data: { secret: string } };
    const confirm2 = await app.request('/api/v1/me/twoFactor/totp/confirm', {
      method: 'POST',
      headers: { ...revivedJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ code: generateTotpCode(s2.secret, Date.now()) }),
    });
    expect(confirm2.status).toBe(200);
  });

  it('enforces spoofing boundaries on all 2FA/passkey routes and has no unauthenticated challenge routes', async () => {
    const { entity: victim } = await createUser();
    const { entity: admin } = await createUser({ platformRole: PlatformRole.superadmin });
    const pre2faAdminJwt = await createUserJwt(admin, { twoFactor: false });

    const adminStart = await app.request('/api/v1/me/twoFactor/totp/start', {
      method: 'POST',
      headers: { ...pre2faAdminJwt, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { data: adminTotp } = (await adminStart.json()) as { data: { secret: string } };
    const adminConfirm = await app.request('/api/v1/me/twoFactor/totp/confirm', {
      method: 'POST',
      headers: { ...pre2faAdminJwt, 'content-type': 'application/json' },
      body: JSON.stringify({ code: generateTotpCode(adminTotp.secret, Date.now() - 30_000) }),
    });
    const { data: adminConfirmed } = (await adminConfirm.json()) as {
      data: { jwt: { token: string } };
    };
    const verifiedAdminJwt = { authorization: `Bearer ${adminConfirmed.jwt.token}` };

    setEnvOverride('REQUIRE_TWO_FACTOR', 'true');
    expect(
      (
        await app.request('/api/v1/me', {
          headers: { ...pre2faAdminJwt, 'x-spoof-user-email': victim.email },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request('/api/v1/me/twoFactor', {
          headers: { ...pre2faAdminJwt, 'x-spoof-user-email': victim.email },
        })
      ).status,
    ).toBe(403);

    for (const [path, body] of [
      ['/api/v1/me/twoFactor/totp/start', {}],
      ['/api/v1/me/twoFactor/passkey/rename', { passkeyId: 'any', name: 'Hacked' }],
      ['/api/v1/me/twoFactor/passkey/delete', { passkeyId: 'any' }],
    ] as const) {
      const spoofBlocked = await app.request(path, {
        method: 'POST',
        headers: {
          ...verifiedAdminJwt,
          'x-spoof-user-email': victim.email,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      expect(spoofBlocked.status).toBe(403);
    }

    const spoofVerify = await app.request('/api/v1/me/twoFactor/verify', {
      method: 'POST',
      headers: {
        ...verifiedAdminJwt,
        'x-spoof-user-email': victim.email,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        method: 'totp',
        code: generateTotpCode(adminTotp.secret, Date.now()),
      }),
    });
    expect(spoofVerify.status).toBe(200);
    const { data: spoofVerifyData } = (await spoofVerify.json()) as {
      data: { jwt?: { token: string } };
    };
    expect((await verifyIssuerJwt(spoofVerifyData.jwt!.token)).sub).toBe(admin.id);

    expect(
      (
        await app.request('/api/v1/twoFactor/challenge/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify({}),
        })
      ).status,
    ).toBe(404);
  });
});
