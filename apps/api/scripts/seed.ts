/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:seed
 * @uses feature:auditLogs
 */
import { seed } from '@template/db/prisma/seed';
import { registerHooks } from '#/hooks';
import { emailSeedSavers } from '#/lib/email/emailSeedSavers';

registerHooks();

await seed(emailSeedSavers);
process.exit(0);
