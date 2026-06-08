import { Prisma } from '@template/db';
import { castArray, uniqBy } from 'lodash-es';
import { parseOrderBy } from '#/lib/routeTemplates/orderBySchema';

type OrderByEntry = Record<string, unknown>;

type BuildOrderByOptions = {
  callerOrderBy?: unknown;
  clientOrderBy?: string[];
};

// Dotted leaf path of a single-chain orderBy entry — `{ user: { name: 'asc' } }` → `user.name`.
// Dedupe key: distinct relation fields (`user.name` vs `user.email`) must NOT collapse.
const orderKey = (entry: OrderByEntry): string => {
  const path: string[] = [];
  let node: unknown = entry;
  while (node && typeof node === 'object') {
    const key = Object.keys(node)[0];
    if (!key) break;
    path.push(key);
    node = (node as Record<string, unknown>)[key];
  }
  return path.join('.');
};

export const buildOrderBy = ({ callerOrderBy, clientOrderBy }: BuildOrderByOptions): OrderByEntry[] => {
  const caller = callerOrderBy ? (castArray(callerOrderBy) as OrderByEntry[]) : [];
  const client = clientOrderBy ? (parseOrderBy(clientOrderBy) as OrderByEntry[]) : [];
  const tiebreaker: OrderByEntry[] = [{ id: Prisma.SortOrder.desc }];

  return uniqBy([...caller, ...client, ...tiebreaker], orderKey);
};
