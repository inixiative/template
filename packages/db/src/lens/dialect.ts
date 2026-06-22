/**
 * @atlas
 * @kind config
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';

export const dialect = {
  stringMode: 'insensitive' as 'insensitive' | undefined,
  jsonNull: Prisma.AnyNull as typeof Prisma.AnyNull | typeof Prisma.JsonNull,
  jsonPath: (segments: string[]): string[] | string => segments,
  supportsScalarListSearch: true,
};
