/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:prisma
 * @uses none
 */
import { seed } from '@template/db/prisma/seed';
import { registerHooks } from '#/hooks';

registerHooks();

try {
  await seed();
  process.exit(0);
} catch {
  process.exit(1);
}
