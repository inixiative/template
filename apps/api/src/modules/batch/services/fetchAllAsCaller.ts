/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses primitive:shared
 */
import { fetchAllPages } from '@template/shared/utils';
import type { Context } from 'hono';
import { castArray } from 'lodash-es';
import { fetchAsCaller } from '#/modules/batch/services/fetchAsCaller';
import type { AppEnv } from '#/types/appEnv';

type PageBody = {
  data: unknown;
  pagination?: { totalPages?: number; nextCursor?: string | null };
};

export type FetchAllAsCallerOptions = { pageSize: number; maxPages: number };

export const fetchAllAsCaller = async (
  c: Context<AppEnv>,
  path: string,
  { pageSize, maxPages }: FetchAllAsCallerOptions,
): Promise<unknown> => {
  const [pathname, search] = path.split('?');
  let single: unknown;
  let paginated = false;

  const rows = await fetchAllPages<unknown, PageBody>(
    async ({ page, cursor }) => {
      const params = new URLSearchParams(search);
      params.set('pageSize', String(pageSize));
      if (cursor) params.set('cursor', cursor);
      else if (page > 1) params.set('page', String(page));

      const { status, body } = await fetchAsCaller(c, `${pathname}?${params}`);
      if (status < 200 || status >= 300) {
        const err = new Error(`GET ${path} answered ${status}`) as Error & { status: number };
        err.status = status;
        throw err;
      }
      return body as PageBody;
    },
    {
      itemsOfResponse: (body) => castArray(body.data),
      maxPages,
      onResponse: (body) => {
        paginated ||= body.pagination !== undefined;
        single = body.data;
      },
      onCapped: ({ reason }) => {
        const err = new Error(`GET ${path} hit its ${reason} cap`) as Error & { capped: true };
        err.capped = true;
        throw err;
      },
    },
  );

  return paginated ? rows : single;
};
