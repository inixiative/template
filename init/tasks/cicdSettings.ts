import { type CicdConfig, cicdSchema, loadCicdConfig, saveCicdConfig } from '../../scripts/cicd/config';

export const updateCicdSettings = (current: CicdConfig, flags: string[]): CicdConfig => {
  const config = structuredClone(current);
  const seen = new Set<string>();
  for (const flag of flags) {
    if (flag === '--' || flag === '--section=cicd') continue;
    const match = /^--([a-z-]+)=(.+)$/.exec(flag);
    if (!match || seen.has(match[1])) throw new Error(`Invalid or repeated CI/CD flag: ${flag.split('=')[0]}`);
    const [, name, value] = match;
    seen.add(name);
    if (name === 'pr' || name === 'drafts') {
      if (value !== 'auto' && value !== 'manual') throw new Error(`--${name} must be auto or manual`);
      if (name === 'pr') config.pullRequests.deploy = value;
      else config.pullRequests.drafts.deploy = value;
    } else if (name === 'staging' || name === 'bot-approvals') {
      if (value !== 'on' && value !== 'off') throw new Error(`--${name} must be on or off`);
      if (name === 'staging') config.staging.enabled = value === 'on';
      else config.pullRequests.allowBotApprovals = value === 'on';
    } else if (name === 'approvals' || name === 'max-previews') {
      if (!/^\d+$/.test(value)) throw new Error(`--${name} must be a nonnegative integer`);
      if (name === 'approvals') config.pullRequests.requiredApprovals = Number(value);
      else config.pullRequests.maxActive = Number(value);
    } else if (name === 'production-branch') config.production.branch = value;
    else if (name === 'staging-branch') config.staging.branch = value;
    else if (name === 'database') {
      if (value !== 'schema-push' && value !== 'migrations') throw new Error('Unknown database strategy');
      config.database.strategy = value;
    } else throw new Error(`Unknown CI/CD flag: --${name}`);
  }
  return cicdSchema.parse(config);
};

export const configureCicd = async (flags: string[], root = process.cwd()) => {
  const current = await loadCicdConfig(root);
  const config = updateCicdSettings(current, flags);
  await saveCicdConfig(config, root);
  return config;
};
