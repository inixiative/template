import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getSecret } from '../tasks/infisicalSetup';
import { getProjectConfig } from '../utils/getProjectConfig';

const execAsync = promisify(exec);

const PLANETSCALE_API = 'https://api.planetscale.com/v1';

type PlanetScaleOrganization = {
  name: string;
  slug?: string;
};

export type PlanetScaleDatabase = {
  id: string;
  name: string;
  region: string;
  created_at: string;
  updated_at: string;
};

export type PlanetScaleBranch = {
  id: string;
  name: string;
  region: string;
  created_at: string;
  updated_at: string;
  production: boolean;
};

type PlanetScalePassword = {
  id: string;
  name: string;
  username: string;
  plain_text: string; // Only available on creation
  connection_strings: {
    general: string;
  };
};

export type PlanetScaleRegion = {
  id: string;
  slug: string;
  display_name: string;
  enabled: boolean;
};

/**
 * Make authenticated request to PlanetScale API
 * Fetches token from Infisical automatically
 */
const planetscaleFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  // Get project config and fetch token ID + token from Infisical
  const config = await getProjectConfig();
  const projectId = config.infisical.projectId;

  if (!projectId) {
    throw new Error('Infisical project not configured. Run Infisical setup first.');
  }

  const tokenId = getSecret('PLANETSCALE_TOKEN_ID', {
    projectId,
    environment: 'root',
  });

  const token = getSecret('PLANETSCALE_TOKEN', {
    projectId,
    environment: 'root',
  });

  // PlanetScale requires: Authorization: <TOKEN_ID>:<TOKEN>
  const authHeader = `${tokenId}:${token}`;

  const response = await fetch(`${PLANETSCALE_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PlanetScale API error (${response.status}): ${error}`);
  }

  return (await response.json()) as T;
};

/**
 * List all organizations user has access to
 * Uses CLI (pscale) instead of API since we may not have a service token yet
 */
export const listOrganizations = async (): Promise<PlanetScaleOrganization[]> => {
  const { stdout } = await execAsync('pscale org list --format json', { encoding: 'utf-8' });
  const orgs = JSON.parse(stdout) as Array<{ name: string; slug?: string }>;

  return orgs.map((org) => ({ name: org.name, slug: org.slug }));
};

/**
 * List available regions for an organization
 */
export const listRegions = async (organizationName: string): Promise<PlanetScaleRegion[]> => {
  const { stdout } = await execAsync(`pscale region list --org ${organizationName} --format json`, {
    encoding: 'utf-8',
  });
  const regions = JSON.parse(stdout) as Array<{
    id?: string;
    slug: string;
    display_name?: string;
    name?: string;
    enabled?: boolean;
  }>;

  return regions
    .map((region) => ({
      id: region.id || region.slug,
      slug: region.slug,
      display_name: region.display_name || region.name || region.slug,
      enabled: region.enabled !== false,
    }))
    .filter((region) => region.enabled);
};

/**
 * Get organization details
 */
export const getOrganization = async (orgName: string): Promise<PlanetScaleOrganization> => {
  return await planetscaleFetch<PlanetScaleOrganization>(`/organizations/${orgName}`);
};

/**
 * Create a database
 * Uses API to support all parameters including replicas
 */
export const createDatabase = async (
  organizationName: string,
  databaseName: string,
  region: string = 'us-east-1',
  clusterSize: string = 'PS-5',
): Promise<PlanetScaleDatabase> => {
  const response = await planetscaleFetch<{ data: PlanetScaleDatabase }>(
    `/organizations/${organizationName}/databases`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: databaseName,
        cluster_size: clusterSize,
        region: region,
        kind: 'postgresql',
        replicas: 0,
      }),
    },
  );
  return response.data;
};

/**
 * Get database details
 * Uses CLI for init script (before service token exists)
 */
export const getDatabase = async (organizationName: string, databaseName: string): Promise<PlanetScaleDatabase> => {
  const { stdout } = await execAsync(`pscale database show ${databaseName} --org ${organizationName} --format json`, {
    encoding: 'utf-8',
  });
  return JSON.parse(stdout);
};

/**
 * Update database settings
 * Uses API since CLI doesn't support configuration updates
 */
export const updateDatabaseSettings = async (
  organizationName: string,
  databaseName: string,
  settings: {
    allow_foreign_key_constraints?: boolean;
    automatic_migrations?: boolean;
    migration_table_name?: string;
    default_branch?: string;
  },
): Promise<void> => {
  await planetscaleFetch<PlanetScaleDatabase>(`/organizations/${organizationName}/databases/${databaseName}`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
};

/**
 * List databases in an organization
 */
export const listDatabases = async (organizationName: string): Promise<PlanetScaleDatabase[]> => {
  const response = await planetscaleFetch<{ data?: PlanetScaleDatabase[] }>(
    `/organizations/${organizationName}/databases`,
  );
  return response.data ?? [];
};

/**
 * Create a branch
 * Uses CLI for init script (before service token exists)
 */
export const createBranch = async (
  organizationName: string,
  databaseName: string,
  branchName: string,
  parentBranch?: string,
): Promise<PlanetScaleBranch> => {
  const parentFlag = parentBranch ? `--from ${parentBranch}` : '';
  const { stdout } = await execAsync(
    `pscale branch create ${databaseName} ${branchName} --org ${organizationName} ${parentFlag} --format json`,
    { encoding: 'utf-8' },
  );
  return JSON.parse(stdout);
};

/**
 * Get branch details
 * Uses CLI for init script (before service token exists)
 */
export const getBranch = async (
  organizationName: string,
  databaseName: string,
  branchName: string,
): Promise<PlanetScaleBranch> => {
  const { stdout } = await execAsync(
    `pscale branch show ${databaseName} ${branchName} --org ${organizationName} --format json`,
    { encoding: 'utf-8' },
  );
  return JSON.parse(stdout);
};

/**
 * List branches for a database
 */
export const listBranches = async (organizationName: string, databaseName: string): Promise<PlanetScaleBranch[]> => {
  const response = await planetscaleFetch<{ data?: PlanetScaleBranch[] }>(
    `/organizations/${organizationName}/databases/${databaseName}/branches`,
  );
  return response.data ?? [];
};

/**
 * Create a role (connection credentials) for a Postgres branch
 * Uses CLI for init script (before service token exists)
 */
export const createRole = async (
  organizationName: string,
  databaseName: string,
  branchName: string,
  roleName: string,
): Promise<PlanetScalePassword> => {
  const { stdout } = await execAsync(
    `pscale role create ${databaseName} ${branchName} ${roleName} --org ${organizationName} --inherited-roles postgres --format json`,
    { encoding: 'utf-8' },
  );
  const result = JSON.parse(stdout);

  const host = result.hostname || result.access_host_url || 'aws.connect.psdb.cloud';
  const connectionString = `postgresql://${result.username}:${result.password}@${host}:5432/postgres`;

  return {
    id: result.id,
    name: result.name || roleName,
    username: result.username,
    plain_text: result.password,
    connection_strings: {
      general: connectionString,
    },
  };
};

/**
 * Create a password (connection string) for a MySQL branch
 * Uses CLI for init script (before service token exists)
 */
export const createPassword = async (
  organizationName: string,
  databaseName: string,
  branchName: string,
  passwordName: string,
): Promise<PlanetScalePassword> => {
  const { stdout } = await execAsync(
    `pscale password create ${databaseName} ${branchName} ${passwordName} --org ${organizationName} --format json`,
    { encoding: 'utf-8' },
  );
  const result = JSON.parse(stdout);

  const host = result.hostname || result.access_host_url || 'aws.connect.psdb.cloud';
  const connectionString = `postgresql://${result.username}:${result.plain_text}@${host}:5432/postgres`;

  return {
    id: result.id,
    name: result.name,
    username: result.username,
    plain_text: result.plain_text,
    connection_strings: {
      general: connectionString,
    },
  };
};

/**
 * List passwords for a branch
 */
export const listPasswords = async (
  organizationName: string,
  databaseName: string,
  branchName: string,
): Promise<PlanetScalePassword[]> => {
  const response = await planetscaleFetch<{ data?: PlanetScalePassword[] }>(
    `/organizations/${organizationName}/databases/${databaseName}/branches/${branchName}/passwords`,
  );
  return response.data ?? [];
};

/**
 * Promote a branch to production
 * Uses CLI for init script (before service token exists)
 */
export const promoteBranch = async (
  organizationName: string,
  databaseName: string,
  branchName: string,
): Promise<PlanetScaleBranch> => {
  const { stdout } = await execAsync(
    `pscale branch promote ${databaseName} ${branchName} --org ${organizationName} --format json`,
    { encoding: 'utf-8' },
  );
  return JSON.parse(stdout);
};

/**
 * Rename a branch
 * Uses API to rename branches
 */
export const renameBranch = async (
  organizationName: string,
  databaseName: string,
  branchName: string,
  newName: string,
): Promise<PlanetScaleBranch> => {
  return await planetscaleFetch<PlanetScaleBranch>(
    `/organizations/${organizationName}/databases/${databaseName}/branches/${branchName}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ new_name: newName }),
    },
  );
};

/**
 * Delete a branch
 * Uses CLI for init script (before service token exists)
 */
export const deleteBranch = async (
  organizationName: string,
  databaseName: string,
  branchName: string,
): Promise<void> => {
  await execAsync(`pscale branch delete ${databaseName} ${branchName} --org ${organizationName} --force`, {
    encoding: 'utf-8',
  });
};

type ServiceToken = {
  id: string;
  token: string;
};

/**
 * Create a PlanetScale service token via CLI
 */
export const createServiceToken = async (orgName: string): Promise<ServiceToken> => {
  const { stdout } = await execAsync(`pscale service-token create --org ${orgName} --format json`, {
    encoding: 'utf-8',
  });

  const result = JSON.parse(stdout);
  return {
    id: result.id,
    token: result.token,
  };
};
