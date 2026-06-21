/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:prisma
 * @uses none
 */
import { seed } from '@template/db/prisma/seed';
import { LogScope, log } from '@template/shared/logger';
import { registerHooks } from '#/hooks';

registerHooks();

try {
  await seed();
  process.exit(0);
} catch (error) {
  log.error('Seed failed:', error, LogScope.seed);
  process.exit(1);
}
