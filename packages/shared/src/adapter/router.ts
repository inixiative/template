import type { Environment } from '@template/shared/utils/env';

export const makeAdapterRouter = <A>(map: Partial<Record<Environment | 'default', A>>): A => {
  const env = (process.env.ENVIRONMENT ?? 'local') as Environment;
  const adapter = map[env] ?? map.default;
  if (adapter === undefined) throw new Error(`makeAdapterRouter: no adapter for env "${env}" and no default`);
  return adapter;
};
