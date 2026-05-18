import { homedir } from 'os';
import { join } from 'path';
import { cliVersion, VCR } from '../../packages/shared/src/vcr';
import { execAsync } from '../utils/exec';

const INFISICAL_API = 'https://app.infisical.com/api';
const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/infisical');
const CLI_PATH = ['/opt/homebrew/bin', join(homedir(), '.bun/bin'), process.env.PATH].filter(Boolean).join(':');

export type InfisicalApp = 'api' | 'web' | 'admin' | 'superadmin';

type InfisicalProject = { id: string; name: string; slug: string };
type InfisicalEnvironment = { id: string; name: string; slug: string };
type InfisicalOrganization = { id: string; name: string; slug: string };

export const getInfisicalToken = async (): Promise<string> => {
  try {
    const { stdout } = await execAsync('infisical user get token', {
      encoding: 'utf-8',
      env: { ...process.env, PATH: CLI_PATH },
    });
    const tokenMatch = stdout.trim().match(/Token: (.+)/);
    if (!tokenMatch) throw new Error('Failed to parse token from infisical user get token');
    return tokenMatch[1];
  } catch (error) {
    throw new Error(`Failed to get Infisical token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const toInfisicalSlug = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length >= 5 ? slug : slug.padEnd(5, '0');
};

const redactSecrets = (s: string) =>
  s
    .replace(/:\/\/([^:]+):([^@]+)@/g, '://REDACTED:REDACTED@')
    .replace(/pscale_tkn_\w+/g, 'REDACTED')
    .replace(/pscale_pw_\w+/g, 'REDACTED')
    .replace(/rw_Fe26\.\S+/g, 'REDACTED');

class InfisicalApi {
  readonly vcr = new VCR(FIXTURES_DIR, {
    service: 'infisical',
    version: () => cliVersion('infisical'),
    sanitizers: {
      getSecret: { fn: redactSecrets },
      setSecret: { fn: redactSecrets },
    },
  });

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

  async listOrganizations(): Promise<InfisicalOrganization[]> {
    return this.vcr.capture('listOrganizations', async () => {
      const response = await this.request<{ organizations?: InfisicalOrganization[] }>('/v1/organization');
      return response.organizations ?? [];
    });
  }

  async getOrganization(organizationId: string): Promise<InfisicalOrganization> {
    return this.vcr.capture('getOrganization', () =>
      this.request<InfisicalOrganization>(`/v1/organization/${organizationId}`),
    );
  }

  async updateProjectSlug(projectId: string, slug: string): Promise<void> {
    return this.vcr.capture('updateProjectSlug', async () => {
      await this.request(`/v2/workspace/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ slug }),
      });
    });
  }

  async upsertProject(name: string): Promise<InfisicalProject> {
    return this.vcr.capture('upsertProject', async () => {
      const token = await getInfisicalToken();
      const orgId = JSON.parse(atob(token.split('.')[1])).organizationId;
      const listResponse = await this.request<{ workspaces?: InfisicalProject[] }>(
        `/v2/organizations/${orgId}/workspaces`,
      );
      const existing = listResponse.workspaces?.find((p) => p.name === name);
      if (existing) return existing;

      const createResponse = await this.request<{ workspace?: InfisicalProject; project?: InfisicalProject }>(
        '/v2/workspace',
        { method: 'POST', body: JSON.stringify({ projectName: name, slug: toInfisicalSlug(name) }) },
      );
      const project = createResponse.workspace ?? createResponse.project;
      if (!project) throw new Error(`Failed to create Infisical project "${name}"`);
      return project;
    });
  }

  async upsertEnvironment(projectId: string, name: string, slug: string): Promise<InfisicalEnvironment> {
    return this.vcr.capture('upsertEnvironment', async () => {
      try {
        const createResponse = await this.request<{ environment: InfisicalEnvironment }>(
          `/v1/projects/${projectId}/environments`,
          { method: 'POST', body: JSON.stringify({ name, slug }) },
        );
        return createResponse.environment;
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) return { id: '', name, slug };
        throw error;
      }
    });
  }

  async deleteEnvironment(projectId: string, environmentId: string): Promise<void> {
    return this.vcr.capture('deleteEnvironment', async () => {
      await this.request(`/v1/projects/${projectId}/environments/${environmentId}`, { method: 'DELETE' });
    });
  }

  async updateEnvironment(
    projectId: string,
    environmentId: string,
    updates: { name?: string; slug?: string; position?: number },
  ): Promise<InfisicalEnvironment> {
    return this.vcr.capture('updateEnvironment', async () => {
      const response = await this.request<{ environment: InfisicalEnvironment }>(
        `/v1/projects/${projectId}/environments/${environmentId}`,
        { method: 'PATCH', body: JSON.stringify(updates) },
      );
      return response.environment;
    });
  }

  async getProject(projectId: string): Promise<InfisicalProject> {
    return this.vcr.capture('getProject', () => this.request<InfisicalProject>(`/v1/workspace/${projectId}`));
  }

  async createFolder(projectId: string, environment: string, name: string, path: string = '/'): Promise<unknown> {
    return this.vcr.capture('createFolder', async () => {
      try {
        return await this.request('/v2/folders', {
          method: 'POST',
          body: JSON.stringify({ projectId, environment, name, path }),
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) return null;
        throw error;
      }
    });
  }

  async createSecretImport(
    projectId: string,
    destinationEnvironment: string,
    destinationPath: string,
    sourceEnvironment: string,
    sourcePath: string,
  ): Promise<void> {
    return this.vcr.capture('createSecretImport', async () => {
      try {
        await this.request('/v2/secret-imports', {
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
    });
  }

  async setSecret(
    projectId: string,
    environment: 'root' | 'staging' | 'prod',
    path: '/' | `/${InfisicalApp}/`,
    key: string,
    value: string,
    type: 'shared' | 'personal' = 'shared',
  ): Promise<void> {
    return this.vcr.capture('setSecret', async () => {
      try {
        await this.request('/v3/secrets/raw', {
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
          await this.request(`/v3/secrets/raw/${key}`, {
            method: 'PATCH',
            body: JSON.stringify({ workspaceId: projectId, environment, secretPath: path, secretValue: value, type }),
          });
        } else if (error instanceof Error && error.message.includes('secretKeyCiphertext')) {
          // E2EE-enabled project — CLI handles the encryption
          await execAsync(
            `infisical secrets set --projectId="${projectId}" --env="${environment}" --path="${path}" "${key}=${value}"`,
            { env: { ...process.env, PATH: CLI_PATH } },
          );
        } else {
          throw error;
        }
      }
    });
  }

  async getSecret(projectId: string, environment: string, key: string, path: string = '/'): Promise<string> {
    return this.vcr.capture('getSecret', async () => {
      const response = await this.request<{ secret: { secretValue: string } }>(
        `/v3/secrets/raw/${key}?workspaceId=${projectId}&environment=${environment}&secretPath=${encodeURIComponent(path)}`,
      );
      return response.secret.secretValue;
    });
  }
}

export const infisicalApi = new InfisicalApi();
