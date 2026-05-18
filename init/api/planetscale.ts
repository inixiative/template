import { homedir } from 'node:os';
import { join } from 'node:path';
import { cliVersion, VCR } from '../../packages/shared/src/vcr';
import { getSecretAsync } from '../tasks/infisicalSetup';
import { execAsync } from '../utils/exec';
import { getProjectConfig } from '../utils/getProjectConfig';

const PLANETSCALE_API = 'https://api.planetscale.com/v1';
const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/planetscale');
const SANITIZE_KEYS = ['plain_text', 'username', 'connection_strings.general'];
const CLI_PATH = ['/opt/homebrew/bin', join(homedir(), '.bun/bin'), process.env.PATH].filter(Boolean).join(':');

const withCliEnv = (
  options: { cwd?: string; encoding?: BufferEncoding; env?: NodeJS.ProcessEnv; shell?: string; timeout?: number } = {},
) => ({
  ...options,
  env: {
    ...process.env,
    ...options.env,
    PATH: [options.env?.PATH, CLI_PATH].filter(Boolean).join(':'),
  },
});

type PlanetScaleOrganization = { name: string; slug?: string };

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
  plain_text: string;
  connection_strings: { general: string };
};

export type PlanetScaleRegion = {
  id: string;
  slug: string;
  display_name: string;
  enabled: boolean;
};

type ServiceToken = { id: string; token: string };

class PlanetScaleApi {
  readonly vcr = new VCR(FIXTURES_DIR, {
    service: 'planetscale',
    version: () => cliVersion('pscale'),
    sanitizers: {
      createPassword: { keys: SANITIZE_KEYS },
      createRole: { keys: SANITIZE_KEYS },
      listPasswords: { keys: SANITIZE_KEYS, isArray: true },
    },
  });

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config = await getProjectConfig();
    const projectId = config.infisical.projectId;
    if (!projectId) throw new Error('Infisical project not configured. Run Infisical setup first.');

    const tokenId = await getSecretAsync('PLANETSCALE_TOKEN_ID', { projectId, environment: 'root' });
    const token = await getSecretAsync('PLANETSCALE_TOKEN', { projectId, environment: 'root' });

    const response = await fetch(`${PLANETSCALE_API}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `${tokenId}:${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) throw new Error(`PlanetScale API error (${response.status}): ${await response.text()}`);
    return (await response.json()) as T;
  }

  async listOrganizations(): Promise<PlanetScaleOrganization[]> {
    return this.vcr.capture('listOrganizations', async () => {
      const { stdout } = await execAsync('pscale org list --format json', withCliEnv({ encoding: 'utf-8' }));
      const orgs = JSON.parse(stdout) as Array<{ name: string; slug?: string }>;
      return orgs.map((org) => ({ name: org.name, slug: org.slug }));
    });
  }

  async listRegions(organizationName: string): Promise<PlanetScaleRegion[]> {
    return this.vcr.capture('listRegions', async () => {
      const { stdout } = await execAsync(
        `pscale region list --org ${organizationName} --format json`,
        withCliEnv({ encoding: 'utf-8' }),
      );
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
    });
  }

  async getOrganization(orgName: string): Promise<PlanetScaleOrganization> {
    return this.vcr.capture('getOrganization', () =>
      this.request<PlanetScaleOrganization>(`/organizations/${orgName}`),
    );
  }

  async createDatabase(
    organizationName: string,
    databaseName: string,
    region: string = 'us-east-1',
    clusterSize: string = 'PS-5',
  ): Promise<PlanetScaleDatabase> {
    return this.vcr.capture('createDatabase', async () => {
      const response = await this.request<{ data: PlanetScaleDatabase }>(
        `/organizations/${organizationName}/databases`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: databaseName,
            cluster_size: clusterSize,
            region,
            kind: 'postgresql',
            replicas: 0,
          }),
        },
      );
      return response.data;
    });
  }

  async getDatabase(organizationName: string, databaseName: string): Promise<PlanetScaleDatabase> {
    return this.vcr.capture('getDatabase', async () => {
      const { stdout } = await execAsync(
        `pscale database show ${databaseName} --org ${organizationName} --format json`,
        withCliEnv({ encoding: 'utf-8' }),
      );
      return JSON.parse(stdout);
    });
  }

  async updateDatabaseSettings(
    organizationName: string,
    databaseName: string,
    settings: {
      allow_foreign_key_constraints?: boolean;
      automatic_migrations?: boolean;
      migration_table_name?: string;
      default_branch?: string;
    },
  ): Promise<void> {
    return this.vcr.capture('updateDatabaseSettings', async () => {
      await this.request<PlanetScaleDatabase>(`/organizations/${organizationName}/databases/${databaseName}`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
    });
  }

  async listDatabases(organizationName: string): Promise<PlanetScaleDatabase[]> {
    return this.vcr.capture('listDatabases', async () => {
      const response = await this.request<{ data?: PlanetScaleDatabase[] }>(
        `/organizations/${organizationName}/databases`,
      );
      return response.data ?? [];
    });
  }

  async createBranch(
    organizationName: string,
    databaseName: string,
    branchName: string,
    parentBranch?: string,
  ): Promise<PlanetScaleBranch> {
    return this.vcr.capture('createBranch', async () => {
      const parentFlag = parentBranch ? `--from ${parentBranch}` : '';
      const { stdout } = await execAsync(
        `pscale branch create ${databaseName} ${branchName} --org ${organizationName} ${parentFlag} --format json`,
        withCliEnv({ encoding: 'utf-8' }),
      );
      return JSON.parse(stdout);
    });
  }

  async getBranch(organizationName: string, databaseName: string, branchName: string): Promise<PlanetScaleBranch> {
    return this.vcr.capture('getBranch', async () => {
      const { stdout } = await execAsync(
        `pscale branch show ${databaseName} ${branchName} --org ${organizationName} --format json`,
        withCliEnv({ encoding: 'utf-8' }),
      );
      return JSON.parse(stdout);
    });
  }

  async listBranches(organizationName: string, databaseName: string): Promise<PlanetScaleBranch[]> {
    return this.vcr.capture('listBranches', async () => {
      const response = await this.request<{ data?: PlanetScaleBranch[] }>(
        `/organizations/${organizationName}/databases/${databaseName}/branches`,
      );
      return response.data ?? [];
    });
  }

  async createRole(
    organizationName: string,
    databaseName: string,
    branchName: string,
    roleName: string,
  ): Promise<PlanetScalePassword> {
    return this.vcr.capture('createRole', async () => {
      const { stdout } = await execAsync(
        `pscale role create ${databaseName} ${branchName} ${roleName} --org ${organizationName} --inherited-roles postgres --format json`,
        withCliEnv({ encoding: 'utf-8' }),
      );
      const result = JSON.parse(stdout);
      const host = result.hostname || result.access_host_url || 'aws.connect.psdb.cloud';
      return {
        id: result.id,
        name: result.name || roleName,
        username: result.username,
        plain_text: result.password,
        connection_strings: { general: `postgresql://${result.username}:${result.password}@${host}:5432/postgres` },
      };
    });
  }

  async createPassword(
    organizationName: string,
    databaseName: string,
    branchName: string,
    passwordName: string,
  ): Promise<PlanetScalePassword> {
    return this.vcr.capture('createPassword', async () => {
      const { stdout } = await execAsync(
        `pscale password create ${databaseName} ${branchName} ${passwordName} --org ${organizationName} --format json`,
        withCliEnv({ encoding: 'utf-8' }),
      );
      const result = JSON.parse(stdout);
      const host = result.hostname || result.access_host_url || 'aws.connect.psdb.cloud';
      return {
        id: result.id,
        name: result.name,
        username: result.username,
        plain_text: result.plain_text,
        connection_strings: {
          general: `postgresql://${result.username}:${result.plain_text}@${host}:5432/postgres`,
        },
      };
    });
  }

  async listPasswords(
    organizationName: string,
    databaseName: string,
    branchName: string,
  ): Promise<PlanetScalePassword[]> {
    return this.vcr.capture('listPasswords', async () => {
      const response = await this.request<{ data?: PlanetScalePassword[] }>(
        `/organizations/${organizationName}/databases/${databaseName}/branches/${branchName}/passwords`,
      );
      return response.data ?? [];
    });
  }

  async promoteBranch(organizationName: string, databaseName: string, branchName: string): Promise<PlanetScaleBranch> {
    return this.vcr.capture('promoteBranch', async () => {
      const { stdout } = await execAsync(
        `pscale branch promote ${databaseName} ${branchName} --org ${organizationName} --format json`,
        withCliEnv({ encoding: 'utf-8' }),
      );
      return JSON.parse(stdout);
    });
  }

  async renameBranch(
    organizationName: string,
    databaseName: string,
    branchName: string,
    newName: string,
  ): Promise<PlanetScaleBranch> {
    return this.vcr.capture('renameBranch', () =>
      this.request<PlanetScaleBranch>(
        `/organizations/${organizationName}/databases/${databaseName}/branches/${branchName}`,
        { method: 'PATCH', body: JSON.stringify({ new_name: newName }) },
      ),
    );
  }

  async deleteBranch(organizationName: string, databaseName: string, branchName: string): Promise<void> {
    return this.vcr.capture('deleteBranch', async () => {
      await execAsync(
        `pscale branch delete ${databaseName} ${branchName} --org ${organizationName} --force`,
        withCliEnv({ encoding: 'utf-8' }),
      );
    });
  }

  async createServiceToken(orgName: string): Promise<ServiceToken> {
    return this.vcr.capture('createServiceToken', async () => {
      const { stdout } = await execAsync(`pscale service-token create --org ${orgName} --format json`, {
        ...withCliEnv(),
        encoding: 'utf-8',
      });
      const result = JSON.parse(stdout);
      return { id: result.id, token: result.token };
    });
  }
}

export const planetscaleApi = new PlanetScaleApi();
