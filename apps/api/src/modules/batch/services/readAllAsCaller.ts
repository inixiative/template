/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses primitive:shared
 */
import { fetchAllPages } from '@template/shared/utils';
import type { Context } from 'hono';
import { castArray } from 'lodash-es';
import { readAsCaller } from '#/modules/batch/services/readAsCaller';
import type { AppEnv } from '#/types/appEnv';

type ReadBody = {
  data: unknown;
  pagination?: { totalPages?: number; nextCursor?: string | null };
};

export type ReadAllOptions = { pageSize: number; maxPages: number };

export const readAllAsCaller = async (
  c: Context<AppEnv>,
  path: string,
  { pageSize, maxPages }: ReadAllOptions,
): Promise<unknown> => {
  const [pathname, search] = path.split('?');
  let single: unknown;
  let paginated = false;

  const rows = await fetchAllPages<unknown, ReadBody>(
    async ({ page, cursor }) => {
      const params = new URLSearchParams(search);
      params.set('pageSize', String(pageSize));
      if (cursor) params.set('cursor', cursor);
      else if (page > 1) params.set('page', String(page));

      const { status, body } = await readAsCaller(c, `${pathname}?${params}`);
      if (status < 200 || status >= 300) throw new Error(`GET ${path} answered ${status}`);
      return body as ReadBody;
    },
    {
      getItems: (body) => castArray(body.data),
      maxPages,
      onResponse: (body) => {
        paginated ||= body.pagination !== undefined;
        single = body.data;
      },
      onCapped: ({ reason }) => {
        throw new Error(`GET ${path} hit its ${reason} cap`);
      },
    },
  );

  return paginated ? rows : single;
};
