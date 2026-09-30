import type { CicdConfig } from './config';

export type DeliveryEvent =
  | { kind: 'push'; branch: string }
  | { kind: 'pull-request'; number: number; draft: boolean; sameRepository: boolean; closed: boolean }
  | { kind: 'deploy'; target: 'production' | 'staging' }
  | { kind: 'deploy-preview'; number: number; sameRepository: boolean; closed: boolean }
  | { kind: 'teardown'; number: number };

export type DeliveryPlan = {
  action: 'deploy' | 'teardown' | 'skip';
  target: string | null;
  reason: string;
  prechecks: boolean;
  postchecks: boolean;
};

export const planDelivery = (config: CicdConfig, event: DeliveryEvent): DeliveryPlan => {
  const result = (action: DeliveryPlan['action'], target: string | null, reason: string): DeliveryPlan => ({
    action,
    target,
    reason,
    prechecks: action === 'deploy',
    postchecks: action === 'deploy',
  });
  if ('number' in event && (!Number.isSafeInteger(event.number) || event.number <= 0))
    throw new Error('A positive PR number is required');
  if (event.kind === 'teardown') return result('teardown', `pr-${event.number}`, 'Explicit preview teardown');
  if (event.kind === 'pull-request' || event.kind === 'deploy-preview') {
    const target = `pr-${event.number}`;
    if (event.closed) {
      return event.kind === 'pull-request'
        ? result('teardown', target, 'PR closed or merged')
        : result('skip', target, 'Closed PRs cannot be deployed');
    }
    if (!event.sameRepository) return result('skip', target, 'Fork previews are not authorized');
    if (event.kind === 'deploy-preview') return result('deploy', target, 'Explicit preview deployment');
    const mode = event.draft ? config.pullRequests.drafts.deploy : config.pullRequests.deploy;
    return mode === 'auto'
      ? result('deploy', target, event.draft ? 'Automatic draft preview' : 'Automatic PR preview')
      : result('skip', target, 'Preview requires an explicit deploy');
  }
  if (event.kind === 'deploy') {
    if (event.target === 'staging' && !config.staging.enabled) return result('skip', 'staging', 'Staging is disabled');
    return result('deploy', event.target, 'Explicit deployment');
  }
  if (event.branch === config.production.branch)
    return result('deploy', 'production', 'Automatic production deployment after CI');
  if (event.branch === config.staging.branch && config.staging.enabled)
    return result('deploy', 'staging', 'Automatic staging deployment after CI');
  return result('skip', null, 'Branch pushes do not create PR previews');
};
