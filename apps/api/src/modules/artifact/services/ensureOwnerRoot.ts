/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { type OwnerRef, ownerColumns } from '#/modules/artifact/lib/artifactOwner';

export const findOwnerRoot = (owner: OwnerRef): Promise<Artifact | null> =>
  db.artifact.findFirst({ where: { ...ownerColumns(owner), kind: 'ownerRoot' } });

export const ensureOwnerRoot = async (owner: OwnerRef): Promise<Artifact> =>
  (await findOwnerRoot(owner)) ??
  db.artifact.create({
    data: {
      ...ownerColumns(owner),
      kind: 'ownerRoot',
      name: 'root',
      system: true,
      access: 'private',
    },
  });
