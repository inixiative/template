import { cacheKey, makeRollingCache } from '@template/db';

export const exampleCounts = makeRollingCache({
  name: 'exampleCounts',
  intervalSeconds: 300,
  key: ({ organizationId }) => cacheKey('exampleCounts', organizationId),
  compute: async () => 1,
  targets: { model: 'Space', args: { distinct: ['organizationId'], select: { organizationId: true } } },
});
