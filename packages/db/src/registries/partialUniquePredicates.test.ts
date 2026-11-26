import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { partialUniquePredicates } from '@template/db/registries/partialUniquePredicates';
import { toModelName } from '@template/db/utils/modelNames';
import { uniqueKeysOnColumn } from '@template/db/utils/uniqueKeysOnColumn';

type PartialUniqueIndex = {
  tablename: string;
  indexname: string;
  predicate: string;
  keyColumns: string[];
};

const partialUniqueIndexes = () =>
  db.$queryRaw<PartialUniqueIndex[]>`
    select t.relname as tablename, i.relname as indexname,
      pg_get_expr(x.indpred, x.indrelid) as predicate,
      array(select a.attname from unnest(x.indkey) as k join pg_attribute a on a.attrelid = x.indrelid and a.attnum = k)::text[] as "keyColumns"
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and x.indisunique and x.indpred is not null`;

const conditionsOf = (predicate: string) =>
  predicate
    .replace(/^\(|\)$/g, '')
    .split(' AND ')
    .map((condition) => condition.replace(/^\(+|\)+$/g, ''));

const onlyRequiresItsKeyToBeSet = ({ predicate, keyColumns }: PartialUniqueIndex) =>
  conditionsOf(predicate).every((condition) =>
    keyColumns.some((column) => condition === `"${column}" IS NOT NULL`),
  );

describe('partialUniquePredicates', () => {
  it('covers every partial unique index whose predicate is more than its key being set', async () => {
    const needingAPredicate = (await partialUniqueIndexes())
      .filter((index) => !onlyRequiresItsKeyToBeSet(index))
      .map(({ indexname }) => indexname)
      .sort();
    expect(Object.keys(partialUniquePredicates).sort()).toEqual(needingAPredicate);
  });

  it('names each entry as the schema map names its index', async () => {
    const unresolved = (await partialUniqueIndexes())
      .filter(({ indexname }) => indexname in partialUniquePredicates)
      .filter(
        ({ tablename, indexname, keyColumns }) =>
          !uniqueKeysOnColumn(toModelName(tablename), keyColumns[0] ?? '').some(
            (key) => key.indexName === indexname,
          ),
      )
      .map(({ indexname }) => indexname);
    expect(unresolved).toEqual([]);
  });
});
