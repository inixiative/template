import type { Prisma } from '../generated/client/client';

export type HydrateInclude = {
  [relation: string]: boolean | HydrateInclude | { include: HydrateInclude };
};

export interface HydratedRecord {
  id: string;
  [key: string]: string | number | boolean | null | undefined | Date | string[] | Prisma.JsonValue | HydratedRecord | HydratedRecord[] | Record<string, unknown>;
}
