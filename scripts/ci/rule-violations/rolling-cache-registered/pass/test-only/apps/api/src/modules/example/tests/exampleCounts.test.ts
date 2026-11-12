import { cacheKey, makeRollingCache } from '@template/db';

const counts = makeRollingCache({
  name: 'test',
  intervalSeconds: 300,
  key: () => cacheKey('t', 'x'),
  compute: async () => 1,
});
