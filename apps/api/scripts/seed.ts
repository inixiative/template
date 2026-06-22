/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:seed
 * @uses feature:auditLogs
 */
import { seed } from '@template/db/prisma/seed';
import { registerHooks } from '#/hooks';

registerHooks();

await seed();
process.exit(0);
