/**
 * @atlas
 * @kind schema
 * @partOf feature:auth
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { PasskeyScalarSchema } from '@template/db';
import { passwordLength } from '@template/shared/auth/passwordLength';
import { TWO_FACTOR_METHODS } from '@template/shared/auth/twoFactor';
import { userJwtHandoffSchema } from '#/modules/me/schemas/changePasswordSchemas';

const twoFactorMethodSchema = z.enum(TWO_FACTOR_METHODS);

export const passkeyResponseSchema = PasskeyScalarSchema.omit({
  publicKey: true,
  counter: true,
  userId: true,
  deviceType: true,
  backedUp: true,
  transports: true,
  deletedAt: true,
  updatedAt: true,
}).strip();

export const twoFactorStatusResponseSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  totpEnabled: z.boolean(),
  backupCodesRemaining: z.number().int().min(0),
  hasPassword: z.boolean(),
  methods: z.array(twoFactorMethodSchema),
  passkeys: z.array(passkeyResponseSchema),
});

const webAuthnCredentialResponseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  response: z.record(z.string(), z.unknown()),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  authenticatorAttachment: z.string().optional(),
});

export const webAuthnOptionsResponseSchema = z.object({
  options: z.record(z.string(), z.unknown()),
  rpId: z.string(),
});

export const verifyFactorBodySchema = z.object({
  method: twoFactorMethodSchema,
  code: z.string().trim().min(6).max(32).optional(),
  response: webAuthnCredentialResponseSchema.optional(),
});

export const verifyFactorBodyRefinement = (
  data: z.infer<typeof verifyFactorBodySchema>,
  ctx: z.RefinementCtx,
) => {
  if ((data.method === 'totp' || data.method === 'backupCode') && !data.code) {
    ctx.addIssue({
      code: 'custom',
      path: ['code'],
      message: data.method === 'totp' ? 'Verification code is required' : 'Backup code is required',
    });
  }
  if (data.method === 'passkey' && !data.response) {
    ctx.addIssue({
      code: 'custom',
      path: ['response'],
      message: 'Passkey response is required',
    });
  }
};

export const enrollmentStartBodySchema = z.object({
  currentPassword: z.string().min(1).max(passwordLength.max).optional(),
});

export const totpStartResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
  issuer: z.string(),
  accountName: z.string(),
});

export const totpConfirmBodySchema = z.object({
  code: z.string().trim().min(6).max(12),
});

export const totpConfirmResponseSchema = z.object({
  enabled: z.boolean(),
  backupCodes: z.array(z.string()).nullable(),
  jwt: userJwtHandoffSchema.optional(),
});

export const backupCodesResponseSchema = z.object({
  backupCodes: z.array(z.string()),
});

export const passkeyConfirmBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  response: webAuthnCredentialResponseSchema,
});

export const passkeyConfirmResponseSchema = z.object({
  passkey: passkeyResponseSchema,
  backupCodes: z.array(z.string()).nullable(),
  jwt: userJwtHandoffSchema.optional(),
});

export const passkeyRenameBodySchema = z.object({
  passkeyId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
});

export const passkeyDeleteBodySchema = z.object({
  passkeyId: z.string().min(1),
});

export const verifyTwoFactorResponseSchema = z.object({
  jwt: userJwtHandoffSchema.optional(),
});
