import { isTest } from '@template/shared/utils';
import type { Env } from '#/config/env';

// SSRF guard policy gate: webhook URLs are tenant-supplied and fetched server-side,
// so deployed environments must enforce https + public-host rules. Local and test
// stay relaxed so development loops can point at localhost / private addresses.
const enforcedEnvironments: Record<Env['ENVIRONMENT'], boolean> = {
  local: false,
  test: false,
  pr: true,
  staging: true,
  prod: true,
};

export const isEnforcedEnvironment = (): boolean => {
  const environment = process.env.ENVIRONMENT ?? (isTest ? 'test' : 'prod');
  return enforcedEnvironments[environment] ?? true;
};
