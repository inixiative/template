/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import type { z } from 'zod';
import { verifyUserPasskey } from '#/lib/twoFactor/passkey/verifyUserPasskey';
import { consumeUserBackupCode } from '#/lib/twoFactor/totp/consumeUserBackupCode';
import { verifyUserTotp } from '#/lib/twoFactor/totp/verifyUserTotp';
import type { verifyFactorBodySchema } from '#/modules/me/schemas/twoFactorSchemas';

export type VerifyFactorInput = z.infer<typeof verifyFactorBodySchema>;

export const verifyUserFactor = async (userId: string, input: VerifyFactorInput): Promise<void> => {
  if (input.method === 'totp') return verifyUserTotp(userId, input.code!);
  if (input.method === 'backupCode') return consumeUserBackupCode(userId, input.code!);
  return verifyUserPasskey({
    userId,
    response: input.response as unknown as AuthenticationResponseJSON,
  });
};
