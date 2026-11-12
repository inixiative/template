import { cacheKey, makeRollingCache } from '@template/db';

makeRollingCache({
  name: 'flowCheck',
  intervalSeconds: 300,
  results: { value: () => cacheKey('flowCheck') },
  compute: async (_target, { results, write }) => write(results.value(), 1),
});
