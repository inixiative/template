import { join } from 'node:path';
import { VCR } from '../../packages/shared/src/vcr';
import { execAsync } from '../utils/exec';

const INFISICAL_API = 'https://app.infisical.com/api';
const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/infisical');
const CLI_PATH = ['/opt/homebrew/bin', '/Users/arongreenspan/.bun/bin', process.env.PATH].filter(Boolean).join(':');

export type InfisicalApp = 'api' | 'web' | 'admin' | 'superadmin';

type InfisicalProject = {
  id: string;
  name: string;
  slug: string;
};

type InfisicalEnvironment = {
  id: string;
  name: string;
  slug: string;
};

type InfisicalOrganization = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Get Infisical access token from CLI session
 */
export const getInfisicalToken = async (): Promise<string> => {
  try {
    const { stdout } = await execAsync('infisical user get token', {
      encoding: 'utf-8',
      env: {
        ...process.env,
        PATH: CLI_PATH,
      },
    });
    const tokenMatch = stdout.trim().match(/Token: (.+)/);
    if (!tokenMatch) throw new Error('Failed to parse token from infisical user get token');
    return tokenMatch[1];
  } catch (error) {
    throw new Error(`Failed to get Infisical token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Convert a project name to a valid Infisical slug.
 * Rules: lowercase, alphanumeric + hyphens, min 5 chars.
 */
export const toInfisicalSlug = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length >= 5 ? slug : slug.padEnd(5, '0');
};

class InfisicalApi {
  readonly vcr = new VCR(FIXTURES_DIR);

  private async _fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getInfisicalToken();
    const response = await fetch(`${INFISICAL_API}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Infisical API error (${response.status}): ${error}`);
    }
    return (await response.json()) as T;
  }

  private async _getOrganizationId(): Promise<string> {
    const token = await getInfisicalToken();
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.organizationId;
  }

  async listOrganizations(): Promise<InfisicalOrganization[]> {
    if (process.env.NODE_ENV !== 'test') return this._listOrganizations();
    return this.vcr.capture('listOrganizations', () => this._listOrganizations());
  }
  private async _listOrganizations(): Promise<InfisicalOrganization[]> {
    const response = await this._fetch<{ organizations?: InfisicalOrganization[] }>('/v1/organization');
    return response.organizations ?? [];
  }

  async getOrganization(organizationId: string): Promise<InfisicalOrganization> {
    if (process.env.NODE_ENV !== 'test') return this._getOrganization(organizationId);
    return this.vcr.capture('getOrganization', () => this._getOrganization(organizationId));
  }
  private async _getOrganization(organizationId: string): Promise<InfisicalOrganization> {
    return this._fetch<InfisicalOrganization>(`/v1/organization/${organizationId}`);
  }

  async updateProjectSlug(projectId: string, slug: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._updateProjectSlug(projectId, slug);
    return this.vcr.capture('updateProjectSlug', () => this._updateProjectSlug(projectId, slug));
  }
  private async _updateProjectSlug(projectId: string, slug: string): Promise<void> {
    await this._fetch(`/v2/workspace/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ slug }),
    });
  }

  async upsertProject(name: string): Promise<InfisicalProject> {
    if (process.env.NODE_ENV !== 'test') return this._upsertProject(name);
    return this.vcr.capture('upsertProject', () => this._upsertProject(name));
  }
  private async _upsertProject(name: string): Promise<InfisicalProject> {
    const orgId = await this._getOrganizationId();
    const listResponse = await this._fetch<{ workspaces?: InfisicalProject[] }>(
      `/v2/organizations/${orgId}/workspaces`,
    );
    const existing = listResponse.workspaces?.find((p) => p.name === name);
    if (existing) return existing;

    const createResponse = await this._fetch<{ workspace?: InfisicalProject; project?: InfisicalProject }>(
      '/v2/workspace',
      {
        method: 'POST',
        body: JSON.stringify({ projectName: name, slug: toInfisicalSlug(name) }),
      },
    );
    const project = createResponse.workspace ?? createResponse.project;
    if (!project) throw new Error(`Failed to create Infisical project "${name}"`);
    return project;
  }

  async upsertEnvironment(projectId: string, name: string, slug: string): Promise<InfisicalEnvironment> {
    if (process.env.NODE_ENV !== 'test') return this._upsertEnvironment(projectId, name, slug);
    return this.vcr.capture('upsertEnvironment', () => this._upsertEnvironment(projectId, name, slug));
  }
  private async _upsertEnvironment(projectId: string, name: string, slug: string): Promise<InfisicalEnvironment> {
    try {
      const createResponse = await this._fetch<{ environment: InfisicalEnvironment }>(
        `/v1/projects/${projectId}/environments`,
        { method: 'POST', body: JSON.stringify({ name, slug }) },
      );
      return createResponse.environment;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return { id: '', name, slug };
      }
      throw error;
    }
  }

  async deleteEnvironment(projectId: string, environmentId: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._deleteEnvironment(projectId, environmentId);
    return this.vcr.capture('deleteEnvironment', () => this._deleteEnvironment(projectId, environmentId));
  }
  private async _deleteEnvironment(projectId: string, environmentId: string): Promise<void> {
    await this._fetch(`/v1/projects/${projectId}/environments/${environmentId}`, { method: 'DELETE' });
  }

  async updateEnvironment(
    projectId: string,
    environmentId: string,
    updates: { name?: string; slug?: string; position?: number },
  ): Promise<InfisicalEnvironment> {
    if (process.env.NODE_ENV !== 'test') return this._updateEnvironment(projectId, environmentId, updates);
    return this.vcr.capture('updateEnvironment', () => this._updateEnvironment(projectId, environmentId, updates));
  }
  private async _updateEnvironment(
    projectId: string,
    environmentId: string,
    updates: { name?: string; slug?: string; position?: number },
  ): Promise<InfisicalEnvironment> {
    const response = await this._fetch<{ environment: InfisicalEnvironment }>(
      `/v1/projects/${projectId}/environments/${environmentId}`,
      { method: 'PATCH', body: JSON.stringify(updates) },
    );
    return response.environment;
  }

  async getProject(projectId: string): Promise<InfisicalProject> {
    if (process.env.NODE_ENV !== 'test') return this._getProject(projectId);
    return this.vcr.capture('getProject', () => this._getProject(projectId));
  }
  private async _getProject(projectId: string): Promise<InfisicalProject> {
    return this._fetch<InfisicalProject>(`/v1/workspace/${projectId}`);
  }

  async createFolder(projectId: string, environment: string, name: string, path: string = '/'): Promise<unknown> {
    if (process.env.NODE_ENV !== 'test') return this._createFolder(projectId, environment, name, path);
    return this.vcr.capture('createFolder', () => this._createFolder(projectId, environment, name, path));
  }
  private async _createFolder(projectId: string, environment: string, name: string, path: string): Promise<unknown> {
    try {
      return await this._fetch('/v2/folders', {
        method: 'POST',
        body: JSON.stringify({ projectId, environment, name, path }),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) return null;
      throw error;
    }
  }

  async createSecretImport(
    projectId: string,
    destinationEnvironment: string,
    destinationPath: string,
    sourceEnvironment: string,
    sourcePath: string,
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      return this._createSecretImport(
        projectId,
        destinationEnvironment,
        destinationPath,
        sourceEnvironment,
        sourcePath,
      );
    }
    return this.vcr.capture('createSecretImport', () =>
      this._createSecretImport(projectId, destinationEnvironment, destinationPath, sourceEnvironment, sourcePath),
    );
  }
  private async _createSecretImport(
    projectId: string,
    destinationEnvironment: string,
    destinationPath: string,
    sourceEnvironment: string,
    sourcePath: string,
  ): Promise<void> {
    try {
      await this._fetch('/v2/secret-imports', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          environment: destinationEnvironment,
          path: destinationPath,
          import: { environment: sourceEnvironment, path: sourcePath },
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) return;
      throw error;
    }
  }

  async setSecret(
    projectId: string,
    environment: 'root' | 'staging' | 'prod',
    path: '/' | `/${InfisicalApp}/`,
    key: string,
    value: string,
    type: 'shared' | 'personal' = 'shared',
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._setSecret(projectId, environment, path, key, value, type);
    return this.vcr.capture('setSecret', () => this._setSecret(projectId, environment, path, key, value, type));
  }
  private async _setSecret(
    projectId: string,
    environment: 'root' | 'staging' | 'prod',
    path: '/' | `/${InfisicalApp}/`,
    key: string,
    value: string,
    type: 'shared' | 'personal',
  ): Promise<void> {
    try {
      await this._fetch('/v3/secrets/raw', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: projectId,
          environment,
          secretPath: path,
          secretKey: key,
          secretValue: value,
          type,
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        await this._fetch(`/v3/secrets/raw/${key}`, {
          method: 'PATCH',
          body: JSON.stringify({ workspaceId: projectId, environment, secretPath: path, secretValue: value, type }),
        });
      } else {
        throw error;
      }
    }
  }
}

export const infisicalApi = new InfisicalApi();
