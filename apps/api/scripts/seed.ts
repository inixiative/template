/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:prisma
 * @uses none
 */
import { seed } from '@template/db/prisma/seed';
import { registerHooks } from '#/hooks';

registerHooks();

await seed();
process.exit(0);
