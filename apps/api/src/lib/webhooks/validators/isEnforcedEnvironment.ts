import type { Env } from '#/config/env';

// SSRF rules apply everywhere except local (where dev loops hit localhost). test enforces so the
// rules are exercised as in prod. `?? true` keeps it fail-closed for any unexpected ENVIRONMENT.
const enforcedEnvironments: Record<Env['ENVIRONMENT'], boolean> = {
  local: false,
  test: true,
  pr: true,
  staging: true,
  prod: true,
};

export const isEnforcedEnvironment = (): boolean =>
  enforcedEnvironments[process.env.ENVIRONMENT as Env['ENVIRONMENT']] ?? true;
