import { homedir } from 'node:os';
import { join } from 'node:path';
import { VCR } from '../../packages/shared/src/vcr';
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
  plain_text: string;
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

type ServiceToken = {
  id: string;
  token: string;
};

class PlanetScaleApi {
  readonly vcr = new VCR(FIXTURES_DIR, {
    createPassword: { keys: SANITIZE_KEYS },
    createRole: { keys: SANITIZE_KEYS },
    listPasswords: { keys: SANITIZE_KEYS, isArray: true },
  });

  private async _fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config = await getProjectConfig();
    const projectId = config.infisical.projectId;
    if (!projectId) throw new Error('Infisical project not configured. Run Infisical setup first.');

    const tokenId = await getSecretAsync('PLANETSCALE_TOKEN_ID', { projectId, environment: 'root' });
    const token = await getSecretAsync('PLANETSCALE_TOKEN', { projectId, environment: 'root' });
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
  }

  async listOrganizations(): Promise<PlanetScaleOrganization[]> {
    if (process.env.NODE_ENV !== 'test') return this._listOrganizations();
    return this.vcr.capture('listOrganizations', () => this._listOrganizations());
  }
  private async _listOrganizations(): Promise<PlanetScaleOrganization[]> {
    const { stdout } = await execAsync('pscale org list --format json', withCliEnv({ encoding: 'utf-8' }));
    const orgs = JSON.parse(stdout) as Array<{ name: string; slug?: string }>;
    return orgs.map((org) => ({ name: org.name, slug: org.slug }));
  }

  async listRegions(organizationName: string): Promise<PlanetScaleRegion[]> {
    if (process.env.NODE_ENV !== 'test') return this._listRegions(organizationName);
    return this.vcr.capture('listRegions', () => this._listRegions(organizationName));
  }
  private async _listRegions(organizationName: string): Promise<PlanetScaleRegion[]> {
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
  }

  async getOrganization(orgName: string): Promise<PlanetScaleOrganization> {
    if (process.env.NODE_ENV !== 'test') return this._getOrganization(orgName);
    return this.vcr.capture('getOrganization', () => this._getOrganization(orgName));
  }
  private async _getOrganization(orgName: string): Promise<PlanetScaleOrganization> {
    return this._fetch<PlanetScaleOrganization>(`/organizations/${orgName}`);
  }

  async createDatabase(
    organizationName: string,
    databaseName: string,
    region: string = 'us-east-1',
    clusterSize: string = 'PS-5',
  ): Promise<PlanetScaleDatabase> {
    if (process.env.NODE_ENV !== 'test')
      return this._createDatabase(organizationName, databaseName, region, clusterSize);
    return this.vcr.capture('createDatabase', () =>
      this._createDatabase(organizationName, databaseName, region, clusterSize),
    );
  }
  private async _createDatabase(
    organizationName: string,
    databaseName: string,
    region: string,
    clusterSize: string,
  ): Promise<PlanetScaleDatabase> {
    const response = await this._fetch<{ data: PlanetScaleDatabase }>(`/organizations/${organizationName}/databases`, {
      method: 'POST',
      body: JSON.stringify({ name: databaseName, cluster_size: clusterSize, region, kind: 'postgresql', replicas: 0 }),
    });
    return response.data;
  }

  async getDatabase(organizationName: string, databaseName: string): Promise<PlanetScaleDatabase> {
    if (process.env.NODE_ENV !== 'test') return this._getDatabase(organizationName, databaseName);
    return this.vcr.capture('getDatabase', () => this._getDatabase(organizationName, databaseName));
  }
  private async _getDatabase(organizationName: string, databaseName: string): Promise<PlanetScaleDatabase> {
    const { stdout } = await execAsync(
      `pscale database show ${databaseName} --org ${organizationName} --format json`,
      withCliEnv({ encoding: 'utf-8' }),
    );
    return JSON.parse(stdout);
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
    if (process.env.NODE_ENV !== 'test') return this._updateDatabaseSettings(organizationName, databaseName, settings);
    return this.vcr.capture('updateDatabaseSettings', () =>
      this._updateDatabaseSettings(organizationName, databaseName, settings),
    );
  }
  private async _updateDatabaseSettings(
    organizationName: string,
    databaseName: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    await this._fetch<PlanetScaleDatabase>(`/organizations/${organizationName}/databases/${databaseName}`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async listDatabases(organizationName: string): Promise<PlanetScaleDatabase[]> {
    if (process.env.NODE_ENV !== 'test') return this._listDatabases(organizationName);
    return this.vcr.capture('listDatabases', () => this._listDatabases(organizationName));
  }
  private async _listDatabases(organizationName: string): Promise<PlanetScaleDatabase[]> {
    const response = await this._fetch<{ data?: PlanetScaleDatabase[] }>(
      `/organizations/${organizationName}/databases`,
    );
    return response.data ?? [];
  }

  async createBranch(
    organizationName: string,
    databaseName: string,
    branchName: string,
    parentBranch?: string,
  ): Promise<PlanetScaleBranch> {
    if (process.env.NODE_ENV !== 'test')
      return this._createBranch(organizationName, databaseName, branchName, parentBranch);
    return this.vcr.capture('createBranch', () =>
      this._createBranch(organizationName, databaseName, branchName, parentBranch),
    );
  }
  private async _createBranch(
    organizationName: string,
    databaseName: string,
    branchName: string,
    parentBranch?: string,
  ): Promise<PlanetScaleBranch> {
    const parentFlag = parentBranch ? `--from ${parentBranch}` : '';
    const { stdout } = await execAsync(
      `pscale branch create ${databaseName} ${branchName} --org ${organizationName} ${parentFlag} --format json`,
      withCliEnv({ encoding: 'utf-8' }),
    );
    return JSON.parse(stdout);
  }

  async getBranch(organizationName: string, databaseName: string, branchName: string): Promise<PlanetScaleBranch> {
    if (process.env.NODE_ENV !== 'test') return this._getBranch(organizationName, databaseName, branchName);
    return this.vcr.capture('getBranch', () => this._getBranch(organizationName, databaseName, branchName));
  }
  private async _getBranch(
    organizationName: string,
    databaseName: string,
    branchName: string,
  ): Promise<PlanetScaleBranch> {
    const { stdout } = await execAsync(
      `pscale branch show ${databaseName} ${branchName} --org ${organizationName} --format json`,
      withCliEnv({ encoding: 'utf-8' }),
    );
    return JSON.parse(stdout);
  }

  async listBranches(organizationName: string, databaseName: string): Promise<PlanetScaleBranch[]> {
    if (process.env.NODE_ENV !== 'test') return this._listBranches(organizationName, databaseName);
    return this.vcr.capture('listBranches', () => this._listBranches(organizationName, databaseName));
  }
  private async _listBranches(organizationName: string, databaseName: string): Promise<PlanetScaleBranch[]> {
    const response = await this._fetch<{ data?: PlanetScaleBranch[] }>(
      `/organizations/${organizationName}/databases/${databaseName}/branches`,
    );
    return response.data ?? [];
  }

  async createRole(
    organizationName: string,
    databaseName: string,
    branchName: string,
    roleName: string,
  ): Promise<PlanetScalePassword> {
    if (process.env.NODE_ENV !== 'test') return this._createRole(organizationName, databaseName, branchName, roleName);
    return this.vcr.capture('createRole', () => this._createRole(organizationName, databaseName, branchName, roleName));
  }
  private async _createRole(
    organizationName: string,
    databaseName: string,
    branchName: string,
    roleName: string,
  ): Promise<PlanetScalePassword> {
    const { stdout } = await execAsync(
      `pscale role create ${databaseName} ${branchName} ${roleName} --org ${organizationName} --inherited-roles postgres --format json`,
      withCliEnv({ encoding: 'utf-8' }),
    );
    const result = JSON.parse(stdout);
    const host = result.hostname || result.access_host_url || 'aws.connect.psdb.cloud';
    const connectionString = `postgresql://${result.username}:${result.password}@${host}:5432/postgres`;
    return {
      id: result.id,
      name: result.name || roleName,
      username: result.username,
      plain_text: result.password,
      connection_strings: { general: connectionString },
    };
  }

  async createPassword(
    organizationName: string,
    databaseName: string,
    branchName: string,
    passwordName: string,
  ): Promise<PlanetScalePassword> {
    if (process.env.NODE_ENV !== 'test')
      return this._createPassword(organizationName, databaseName, branchName, passwordName);
    return this.vcr.capture('createPassword', () =>
      this._createPassword(organizationName, databaseName, branchName, passwordName),
    );
  }
  private async _createPassword(
    organizationName: string,
    databaseName: string,
    branchName: string,
    passwordName: string,
  ): Promise<PlanetScalePassword> {
    const { stdout } = await execAsync(
      `pscale password create ${databaseName} ${branchName} ${passwordName} --org ${organizationName} --format json`,
      withCliEnv({ encoding: 'utf-8' }),
    );
    const result = JSON.parse(stdout);
    const host = result.hostname || result.access_host_url || 'aws.connect.psdb.cloud';
    const connectionString = `postgresql://${result.username}:${result.plain_text}@${host}:5432/postgres`;
    return {
      id: result.id,
      name: result.name,
      username: result.username,
      plain_text: result.plain_text,
      connection_strings: { general: connectionString },
    };
  }

  async listPasswords(
    organizationName: string,
    databaseName: string,
    branchName: string,
  ): Promise<PlanetScalePassword[]> {
    if (process.env.NODE_ENV !== 'test') return this._listPasswords(organizationName, databaseName, branchName);
    return this.vcr.capture('listPasswords', () => this._listPasswords(organizationName, databaseName, branchName));
  }
  private async _listPasswords(
    organizationName: string,
    databaseName: string,
    branchName: string,
  ): Promise<PlanetScalePassword[]> {
    const response = await this._fetch<{ data?: PlanetScalePassword[] }>(
      `/organizations/${organizationName}/databases/${databaseName}/branches/${branchName}/passwords`,
    );
    return response.data ?? [];
  }

  async promoteBranch(organizationName: string, databaseName: string, branchName: string): Promise<PlanetScaleBranch> {
    if (process.env.NODE_ENV !== 'test') return this._promoteBranch(organizationName, databaseName, branchName);
    return this.vcr.capture('promoteBranch', () => this._promoteBranch(organizationName, databaseName, branchName));
  }
  private async _promoteBranch(
    organizationName: string,
    databaseName: string,
    branchName: string,
  ): Promise<PlanetScaleBranch> {
    const { stdout } = await execAsync(
      `pscale branch promote ${databaseName} ${branchName} --org ${organizationName} --format json`,
      withCliEnv({ encoding: 'utf-8' }),
    );
    return JSON.parse(stdout);
  }

  async renameBranch(
    organizationName: string,
    databaseName: string,
    branchName: string,
    newName: string,
  ): Promise<PlanetScaleBranch> {
    if (process.env.NODE_ENV !== 'test') return this._renameBranch(organizationName, databaseName, branchName, newName);
    return this.vcr.capture('renameBranch', () =>
      this._renameBranch(organizationName, databaseName, branchName, newName),
    );
  }
  private async _renameBranch(
    organizationName: string,
    databaseName: string,
    branchName: string,
    newName: string,
  ): Promise<PlanetScaleBranch> {
    return this._fetch<PlanetScaleBranch>(
      `/organizations/${organizationName}/databases/${databaseName}/branches/${branchName}`,
      { method: 'PATCH', body: JSON.stringify({ new_name: newName }) },
    );
  }

  async deleteBranch(organizationName: string, databaseName: string, branchName: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._deleteBranch(organizationName, databaseName, branchName);
    return this.vcr.capture('deleteBranch', () => this._deleteBranch(organizationName, databaseName, branchName));
  }
  private async _deleteBranch(organizationName: string, databaseName: string, branchName: string): Promise<void> {
    await execAsync(
      `pscale branch delete ${databaseName} ${branchName} --org ${organizationName} --force`,
      withCliEnv({ encoding: 'utf-8' }),
    );
  }

  async createServiceToken(orgName: string): Promise<ServiceToken> {
    if (process.env.NODE_ENV !== 'test') return this._createServiceToken(orgName);
    return this.vcr.capture('createServiceToken', () => this._createServiceToken(orgName));
  }
  private async _createServiceToken(orgName: string): Promise<ServiceToken> {
    const { stdout } = await execAsync(`pscale service-token create --org ${orgName} --format json`, {
      ...withCliEnv(),
      encoding: 'utf-8',
    });
    const result = JSON.parse(stdout);
    return { id: result.id, token: result.token };
  }
}

export const planetscaleApi = new PlanetScaleApi();
