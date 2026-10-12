/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses primitive:batch, primitive:shared
 */
import { type Condition, check } from '@inixiative/json-rules';
import { fetchAllPages } from '@template/shared/utils';
import type { Context } from 'hono';
import { castArray } from 'lodash-es';
import type { FlowStep } from '#/modules/flow/schemas/flowSchemas';
import { readAsCaller } from '#/modules/flow/services/readAsCaller';
import type { AppEnv } from '#/types/appEnv';

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

type ReadBody = {
  data: unknown;
  pagination?: { totalPages?: number; nextCursor?: string | null };
};

export const stepHolds = async (c: Context<AppEnv>, step: FlowStep): Promise<boolean> => {
  const [pathname, search] = step.readPath.split('?');
  let isList = false;

  const rows = await fetchAllPages<unknown, ReadBody>(
    async ({ page, cursor }) => {
      const params = new URLSearchParams(search);
      params.set('pageSize', String(PAGE_SIZE));
      if (cursor) params.set('cursor', cursor);
      else if (page > 1) params.set('page', String(page));

      const { status, body, error } = await readAsCaller(c, `${pathname}?${params}`);
      if (status < 200 || status >= 300)
        throw new Error(`Flow step "${step.key}" read answered ${status}: ${error}`);
      return body as ReadBody;
    },
    {
      getItems: (body) => castArray(body.data),
      maxPages: MAX_PAGES,
      onResponse: (body) => {
        isList ||= body.pagination !== undefined;
      },
      onCapped: ({ reason }) => {
        throw new Error(`Flow step "${step.key}" read hit its ${reason} cap`);
      },
    },
  );

  return check(step.rule as Condition, { data: isList ? rows : rows[0] }) === true;
};
