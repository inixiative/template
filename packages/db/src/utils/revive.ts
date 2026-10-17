/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Prisma } from '@template/db/generated/client/client';

// biome-ignore lint/suspicious/noExplicitAny: Prisma delegate constraints require any for structural compatibility
type HasUpdateManyAndReturn = { updateManyAndReturn: (args: any) => Promise<any> };

// Restore tombstoned rows through the mutation lifecycle, so the cascade hook
// revives the subtree that died with them (matched by tombstone timestamp).
export const revive = <T extends HasUpdateManyAndReturn>(
  delegate: T,
  where: Prisma.Args<T, 'updateManyAndReturn'> extends { where?: infer W } ? W : never,
): Promise<Prisma.Result<T, { data: { deletedAt: null } }, 'updateManyAndReturn'>> =>
  delegate.updateManyAndReturn({
    where: { ...(where as Record<string, unknown>), deletedAt: { not: null } },
    data: { deletedAt: null },
  });
