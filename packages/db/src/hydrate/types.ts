/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { EntitlementEntry } from '@inixiative/permissions';
import type { Prisma } from '@template/db/generated/client/client';

export type HydrateInclude = {
  [relation: string]: boolean | HydrateInclude | { include: HydrateInclude };
};

export interface HydratedRecord {
  id: string;
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | Date
    | string[]
    | Prisma.JsonValue
    | HydratedRecord
    | HydratedRecord[]
    | EntitlementEntry[]
    | Record<string, unknown>;
}
