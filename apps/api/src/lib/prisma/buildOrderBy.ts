import { Prisma } from '@template/db';
import { castArray, uniqBy } from 'lodash-es';
import { parseOrderBy } from '#/lib/routeTemplates/orderBySchema';

type OrderByEntry = Record<string, Prisma.SortOrder>;

type BuildOrderByOptions = {
  callerOrderBy?: unknown;
  clientOrderBy?: string[];
  orderableFields?: readonly string[];
};

export const buildOrderBy = ({
  callerOrderBy,
  clientOrderBy,
  orderableFields,
}: BuildOrderByOptions): OrderByEntry[] => {
  const caller = callerOrderBy ? (castArray(callerOrderBy) as OrderByEntry[]) : [];
  const client = clientOrderBy ? (parseOrderBy(clientOrderBy, orderableFields) as OrderByEntry[]) : [];
  const tiebreaker: OrderByEntry[] = [{ id: Prisma.SortOrder.desc }];

  return uniqBy([...caller, ...client, ...tiebreaker], (entry) => Object.keys(entry)[0]);
};
