/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

const PUBLISH_AT_COMMIT = `
local published = {}
for i = 1, #KEYS / 3 do
  local k = (i - 1) * 3
  local a = 2 + (i - 1) * 5
  local current = redis.call('get', KEYS[k + 2]) or '0'
  if ARGV[a + 5] == '1' then
    redis.call('del', KEYS[k + 1])
    redis.call('del', KEYS[k + 3])
    redis.call('set', KEYS[k + 2], ARGV[a + 2], 'EX', ARGV[1])
  end
  if ARGV[a + 4] ~= '' and current == ARGV[a + 1] then
    redis.call('setex', KEYS[k + 1], ARGV[a + 3], ARGV[a + 4])
    redis.call('setex', KEYS[k + 3], ARGV[a + 3], ARGV[2])
    published[i] = '1'
  else
    published[i] = '0'
  end
end
return table.concat(published)
`;

export type CommitEntry = {
  key: string;
  generationKey: string;
  writtenKey: string;
  captured: string;
  clearedGeneration: string;
  ttlSeconds: number;
  payload: string;
  shouldClear: boolean;
};

export const publishAtCommit = async (
  redis: RedisEval,
  entries: CommitEntry[],
  generationTtlSeconds: number,
): Promise<boolean[]> => {
  const published = String(
    await redis.eval(
      PUBLISH_AT_COMMIT,
      entries.length * 3,
      ...entries.flatMap((entry) => [entry.key, entry.generationKey, entry.writtenKey]),
      String(generationTtlSeconds),
      String(Date.now()),
      ...entries.flatMap((entry) => [
        entry.captured,
        entry.clearedGeneration,
        String(entry.ttlSeconds),
        entry.payload,
        entry.shouldClear ? '1' : '0',
      ]),
    ),
  );
  return [...published].map((flag) => flag === '1');
};
