import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { VCR } from '../../packages/shared/src/vcr';
import { getSecretAsync, setSecretAsync } from '../tasks/infisicalSetup';
import { execAsync } from '../utils/exec';
import { getProjectConfig } from '../utils/getProjectConfig';

const escapeName = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_CONFIG_PATH = join(homedir(), '.railway', 'config.json');
const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/railway');

export type RailwayWorkspace = {
  id: string;
  name: string;
};

export type RailwayProject = {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
};

export type RailwayService = {
  id: string;
  name: string;
  projectId: string;
  serviceInstanceId?: string;
  domains?: string[];
};

export type RailwayRedis = {
  id: string;
  name: string;
  projectId: string;
  environmentId?: string;
};

export type RailwayDeployment = {
  id: string;
  status: 'BUILDING' | 'DEPLOYING' | 'SUCCESS' | 'FAILED' | 'CRASHED';
  url?: string;
};

class RailwayApi {
  readonly vcr = new VCR(FIXTURES_DIR);

  private async _railwayGraphQLWithToken<T>(
    token: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read response body');
      throw new Error(
        `Railway API error: ${response.status} ${response.statusText}\n` +
          `Endpoint: ${RAILWAY_API}\n` +
          `Response: ${errorBody}`,
      );
    }

    const result = (await response.json()) as { data: T; errors?: Array<{ message: string }> };

    if (result.errors && result.errors.length > 0) {
      const errorMessages = (result.errors as Array<{ message: string }>).map((e) => e.message).join(', ');
      throw new Error(`Railway GraphQL error: ${errorMessages}`);
    }

    return result.data as T;
  }

  private async _railwayGraphQLUser<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const token = await this._getRailwayUserToken();
    return this._railwayGraphQLWithToken<T>(token, query, variables);
  }

  async getRailwayUserToken(): Promise<string> {
    if (process.env.NODE_ENV !== 'test') return this._getRailwayUserToken();
    return this.vcr.capture('getRailwayUserToken', () => this._getRailwayUserToken());
  }
  private async _getRailwayUserToken(): Promise<string> {
    const config = await getProjectConfig();
    const projectId = config.infisical.projectId;

    if (!projectId) {
      throw new Error('Infisical project not configured. Run Infisical setup first.');
    }

    try {
      const token = await getSecretAsync('RAILWAY_USER_TOKEN', { projectId, environment: 'root' });
      if (token) return token;
    } catch (_error) {
      // Token not in Infisical, try Railway CLI config
    }

    try {
      await access(RAILWAY_CONFIG_PATH);
      const railwayConfig = JSON.parse(await readFile(RAILWAY_CONFIG_PATH, 'utf-8'));
      const token = railwayConfig?.user?.token;
      if (token) {
        await setSecretAsync(projectId, 'root', 'RAILWAY_USER_TOKEN', token);
        return token;
      }
    } catch (_error) {
      // Fall through to error
    }

    throw new Error('Railway user token not found. Please run: railway login');
  }

  async getRailwayWorkspaceToken(): Promise<string> {
    if (process.env.NODE_ENV !== 'test') return this._getRailwayWorkspaceToken();
    return this.vcr.capture('getRailwayWorkspaceToken', () => this._getRailwayWorkspaceToken());
  }
  private async _getRailwayWorkspaceToken(): Promise<string> {
    const config = await getProjectConfig();
    const projectId = config.infisical.projectId;

    if (!projectId) {
      throw new Error('Infisical project not configured. Run Infisical setup first.');
    }

    try {
      const token = await getSecretAsync('RAILWAY_WORKSPACE_TOKEN', { projectId, environment: 'root' });
      if (token) return token;
    } catch (_error) {
      // Not found
    }

    throw new Error(
      'Railway workspace token not found. Create one at https://railway.com/account/tokens ' +
        'and add it to Infisical root environment as RAILWAY_WORKSPACE_TOKEN',
    );
  }

  async listWorkspaces(): Promise<RailwayWorkspace[]> {
    if (process.env.NODE_ENV !== 'test') return this._listWorkspaces();
    return this.vcr.capture('listWorkspaces', () => this._listWorkspaces());
  }
  private async _listWorkspaces(): Promise<RailwayWorkspace[]> {
    try {
      const { stdout } = await execAsync('railway whoami --json', { encoding: 'utf-8' });
      const data = JSON.parse(stdout.trim()) as { workspaces?: RailwayWorkspace[] };
      return data.workspaces ?? [];
    } catch (_error) {
      return [];
    }
  }

  async createProject(workspaceId: string, name: string): Promise<RailwayProject> {
    if (process.env.NODE_ENV !== 'test') return this._createProject(workspaceId, name);
    return this.vcr.capture('createProject', () => this._createProject(workspaceId, name));
  }
  private async _createProject(workspaceId: string, name: string): Promise<RailwayProject> {
    try {
      const { stdout } = await execAsync(`railway init -n "${name}" -w "${workspaceId}" --json`, { encoding: 'utf-8' });
      const lines = stdout.split('\n');
      const jsonLine = lines.find((line) => line.trim().startsWith('{'));
      if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
      const data = JSON.parse(jsonLine);
      return { id: data.id, name: data.name, workspaceId, createdAt: new Date().toISOString() };
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to create Railway project: ${error.message}`);
      throw error;
    }
  }

  async isServiceConnectedToGitHub(serviceId: string, environmentId: string): Promise<boolean> {
    if (process.env.NODE_ENV !== 'test') return this._isServiceConnectedToGitHub(serviceId, environmentId);
    return this.vcr.capture('isServiceConnectedToGitHub', () =>
      this._isServiceConnectedToGitHub(serviceId, environmentId),
    );
  }
  private async _isServiceConnectedToGitHub(serviceId: string, environmentId: string): Promise<boolean> {
    const query = `
      query ServiceInstance($serviceId: String!, $environmentId: String!) {
        serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
          id
          source { repo }
        }
      }
    `;
    const data = await this._railwayGraphQLUser<{
      serviceInstance: { id: string; source: { repo: string } | null } | null;
    }>(query, { serviceId, environmentId });
    return !!data.serviceInstance?.source?.repo;
  }

  async connectServiceToGitHub(
    serviceId: string,
    environmentId: string,
    repo: string,
    branch: string = 'main',
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._connectServiceToGitHub(serviceId, environmentId, repo, branch);
    return this.vcr.capture('connectServiceToGitHub', () =>
      this._connectServiceToGitHub(serviceId, environmentId, repo, branch),
    );
  }
  private async _connectServiceToGitHub(
    serviceId: string,
    environmentId: string,
    repo: string,
    _branch: string,
  ): Promise<void> {
    const data = await this._railwayGraphQLUser<{ serviceInstanceUpdate: boolean }>(
      `
        mutation ServiceInstanceUpdate(
          $serviceId: String!,
          $environmentId: String!,
          $input: ServiceInstanceUpdateInput!
        ) {
          serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
        }
      `,
      { serviceId, environmentId, input: { source: { repo } } },
    );
    if (!data.serviceInstanceUpdate) {
      throw new Error(
        `Failed to connect service ${serviceId} to GitHub repository ${repo} in environment ${environmentId}`,
      );
    }
  }

  async renameService(serviceId: string, name: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._renameService(serviceId, name);
    return this.vcr.capture('renameService', () => this._renameService(serviceId, name));
  }
  private async _renameService(serviceId: string, name: string): Promise<void> {
    await this._railwayGraphQLUser<{ serviceUpdate: { id: string; name: string } }>(
      `
        mutation ServiceUpdate($id: String!, $input: ServiceUpdateInput!) {
          serviceUpdate(id: $id, input: $input) { id name }
        }
      `,
      { id: serviceId, input: { name } },
    );
  }

  async updateServiceInstanceConfig(
    serviceId: string,
    environmentId: string,
    input: { rootDirectory?: string; buildCommand?: string; startCommand?: string },
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._updateServiceInstanceConfig(serviceId, environmentId, input);
    return this.vcr.capture('updateServiceInstanceConfig', () =>
      this._updateServiceInstanceConfig(serviceId, environmentId, input),
    );
  }
  private async _updateServiceInstanceConfig(
    serviceId: string,
    environmentId: string,
    input: { rootDirectory?: string; buildCommand?: string; startCommand?: string },
  ): Promise<void> {
    const data = await this._railwayGraphQLUser<{ serviceInstanceUpdate: boolean }>(
      `
        mutation ServiceInstanceUpdate(
          $serviceId: String!,
          $environmentId: String!,
          $input: ServiceInstanceUpdateInput!
        ) {
          serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
        }
      `,
      { serviceId, environmentId, input },
    );
    if (!data.serviceInstanceUpdate) {
      throw new Error(
        `Failed to update service instance config for service ${serviceId} in environment ${environmentId}`,
      );
    }
  }

  async getProjectVolumes(projectId: string): Promise<Array<{ id: string; name: string }>> {
    if (process.env.NODE_ENV !== 'test') return this._getProjectVolumes(projectId);
    return this.vcr.capture('getProjectVolumes', () => this._getProjectVolumes(projectId));
  }
  private async _getProjectVolumes(projectId: string): Promise<Array<{ id: string; name: string }>> {
    const data = await this._railwayGraphQLUser<{
      project: { volumes: { edges: Array<{ node: { id: string; name: string } }> } };
    }>(
      `
        query Project($id: String!) {
          project(id: $id) {
            volumes { edges { node { id name } } }
          }
        }
      `,
      { id: projectId },
    );
    return data.project.volumes.edges.map((edge) => edge.node);
  }

  async getServiceVolume(projectId: string, serviceName: string): Promise<{ id: string; name: string } | null> {
    if (process.env.NODE_ENV !== 'test') return this._getServiceVolume(projectId, serviceName);
    return this.vcr.capture('getServiceVolume', () => this._getServiceVolume(projectId, serviceName));
  }
  private async _getServiceVolume(
    projectId: string,
    serviceName: string,
  ): Promise<{ id: string; name: string } | null> {
    const volumes = await this._getProjectVolumes(projectId);
    if (volumes.length === 0) return null;
    // Match by name first (works after volumes are renamed in earlier steps)
    const match = volumes.find((v) => v.name.includes(serviceName));
    if (match) return match;
    // Fallback: return the last volume (works when there's only one or volumes haven't been renamed yet)
    return volumes[volumes.length - 1];
  }

  async renameVolume(volumeId: string, name: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._renameVolume(volumeId, name);
    return this.vcr.capture('renameVolume', () => this._renameVolume(volumeId, name));
  }
  private async _renameVolume(volumeId: string, name: string): Promise<void> {
    await this._railwayGraphQLUser<{ volumeUpdate: { id: string; name: string } }>(
      `
        mutation VolumeUpdate($volumeId: String!, $input: VolumeUpdateInput!) {
          volumeUpdate(volumeId: $volumeId, input: $input) { id name }
        }
      `,
      { volumeId, input: { name } },
    );
  }

  async createService(
    projectId: string,
    _environmentId: string,
    environmentName: string,
    name: string,
  ): Promise<RailwayService> {
    if (process.env.NODE_ENV !== 'test') return this._createService(projectId, _environmentId, environmentName, name);
    return this.vcr.capture('createService', () =>
      this._createService(projectId, _environmentId, environmentName, name),
    );
  }
  private async _createService(
    projectId: string,
    _environmentId: string,
    environmentName: string,
    name: string,
  ): Promise<RailwayService> {
    await execAsync(`railway environment link "${escapeName(environmentName)}"`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
      env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
    });
    const escapedName = escapeName(name);
    const { stdout } = await execAsync(`railway add --service "${escapedName}" --json`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
      env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
    });
    const lines = stdout.split('\n');
    const jsonLine = lines.find((line) => line.trim().startsWith('{'));
    if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
    const data = JSON.parse(jsonLine);
    return { id: data.id || data.serviceId, name: data.name || name, projectId };
  }

  async getProjectEnvironments(projectId: string): Promise<Array<{ id: string; name: string }>> {
    if (process.env.NODE_ENV !== 'test') return this._getProjectEnvironments(projectId);
    return this.vcr.capture('getProjectEnvironments', () => this._getProjectEnvironments(projectId));
  }
  private async _getProjectEnvironments(projectId: string): Promise<Array<{ id: string; name: string }>> {
    const data = await this._railwayGraphQLUser<{
      project: { environments: { edges: Array<{ node: { id: string; name: string } }> } };
    }>(
      `
        query GetEnvironments($projectId: String!) {
          project(id: $projectId) {
            environments { edges { node { id name } } }
          }
        }
      `,
      { projectId },
    );
    return data.project.environments.edges.map((edge) => edge.node);
  }

  async createEnvironment(
    projectId: string,
    name: string,
    sourceEnvironmentId?: string,
  ): Promise<{ id: string; name: string }> {
    if (process.env.NODE_ENV !== 'test') return this._createEnvironment(projectId, name, sourceEnvironmentId);
    return this.vcr.capture('createEnvironment', () => this._createEnvironment(projectId, name, sourceEnvironmentId));
  }
  private async _createEnvironment(
    projectId: string,
    name: string,
    sourceEnvironmentId?: string,
  ): Promise<{ id: string; name: string }> {
    try {
      const duplicateFlag = sourceEnvironmentId ? `--duplicate ${sourceEnvironmentId}` : '';
      const { stdout } = await execAsync(`railway environment new "${escapeName(name)}" ${duplicateFlag} --json`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
      });
      const lines = stdout.split('\n');
      const jsonLine = lines.find((line) => line.trim().startsWith('{'));
      if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
      const data = JSON.parse(jsonLine);
      return { id: data.id || data.environmentId, name: data.name || name };
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to create environment: ${error.message}`);
      throw error;
    }
  }

  async deleteEnvironment(projectId: string, environmentName: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._deleteEnvironment(projectId, environmentName);
    return this.vcr.capture('deleteEnvironment', () => this._deleteEnvironment(projectId, environmentName));
  }
  private async _deleteEnvironment(projectId: string, environmentName: string): Promise<void> {
    try {
      await execAsync(`railway environment delete "${escapeName(environmentName)}" --yes --json`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
      });
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to delete environment: ${error.message}`);
      throw error;
    }
  }

  async renameEnvironment(environmentId: string, newName: string): Promise<boolean> {
    if (process.env.NODE_ENV !== 'test') return this._renameEnvironment(environmentId, newName);
    return this.vcr.capture('renameEnvironment', () => this._renameEnvironment(environmentId, newName));
  }
  private async _renameEnvironment(environmentId: string, newName: string): Promise<boolean> {
    const data = await this._railwayGraphQLUser<{ environmentRename: boolean }>(
      `
        mutation RenameEnvironment($id: String!, $name: String!) {
          environmentRename(id: $id, input: { name: $name })
        }
      `,
      { id: environmentId, name: newName },
    );
    return data.environmentRename;
  }

  async createRedis(projectId: string, environmentId: string, environmentName: string): Promise<RailwayRedis> {
    if (process.env.NODE_ENV !== 'test') return this._createRedis(projectId, environmentId, environmentName);
    return this.vcr.capture('createRedis', () => this._createRedis(projectId, environmentId, environmentName));
  }
  private async _createRedis(projectId: string, environmentId: string, environmentName: string): Promise<RailwayRedis> {
    try {
      await execAsync(`railway environment link "${escapeName(environmentName)}"`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
      });
      const { stdout } = await execAsync(`railway add -d redis --json`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
      });
      const lines = stdout.split('\n');
      const jsonLine = lines.find((line) => line.trim().startsWith('{'));
      if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
      const data = JSON.parse(jsonLine);
      return { id: data.serviceId || data.id, name: data.name || 'redis', projectId, environmentId };
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to provision Redis: ${error.message}`);
      throw error;
    }
  }

  async getRedisUrl(
    serviceId: string,
    _environmentId: string,
    environmentName: string,
    projectId: string,
  ): Promise<string> {
    if (process.env.NODE_ENV !== 'test')
      return this._getRedisUrl(serviceId, _environmentId, environmentName, projectId);
    return this.vcr.capture('getRedisUrl', () =>
      this._getRedisUrl(serviceId, _environmentId, environmentName, projectId),
    );
  }
  private async _getRedisUrl(
    serviceId: string,
    _environmentId: string,
    environmentName: string,
    projectId: string,
  ): Promise<string> {
    try {
      const { stdout } = await execAsync(`railway variables list -s ${serviceId} -e ${environmentName} --json`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
      });
      const variables = JSON.parse(stdout.trim());
      const redisUrl = variables.REDIS_URL;
      if (!redisUrl) throw new Error('REDIS_URL not found in service variables');
      return redisUrl;
    } catch (error) {
      if (error instanceof Error) throw new Error(`Failed to get Redis URL: ${error.message}`);
      throw error;
    }
  }

  async setEnvironmentVariables(
    serviceId: string,
    environmentId: string,
    variables: Record<string, string>,
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._setEnvironmentVariables(serviceId, environmentId, variables);
    return this.vcr.capture('setEnvironmentVariables', () =>
      this._setEnvironmentVariables(serviceId, environmentId, variables),
    );
  }
  private async _setEnvironmentVariables(
    serviceId: string,
    environmentId: string,
    variables: Record<string, string>,
  ): Promise<void> {
    await this._railwayGraphQLUser<{ variableCollectionUpsert: { id: string } }>(
      `
        mutation SetVariables($serviceId: String!, $environmentId: String!, $variables: String!) {
          variableCollectionUpsert(input: { serviceId: $serviceId, environmentId: $environmentId, variables: $variables }) {
            id
          }
        }
      `,
      { serviceId, environmentId, variables: JSON.stringify(variables) },
    );
  }

  async getLatestDeployment(serviceId: string, environmentId: string): Promise<RailwayDeployment | null> {
    if (process.env.NODE_ENV !== 'test') return this._getLatestDeployment(serviceId, environmentId);
    return this.vcr.capture('getLatestDeployment', () => this._getLatestDeployment(serviceId, environmentId));
  }
  private async _getLatestDeployment(serviceId: string, environmentId: string): Promise<RailwayDeployment | null> {
    const data = await this._railwayGraphQLUser<{
      serviceInstance: { latestDeployment: RailwayDeployment | null };
    }>(
      `
        query ServiceInstance($serviceId: String!, $environmentId: String!) {
          serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
            latestDeployment { id status }
          }
        }
      `,
      { serviceId, environmentId },
    );
    return data.serviceInstance.latestDeployment;
  }

  async triggerServiceDeployment(serviceId: string, environmentId: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._triggerServiceDeployment(serviceId, environmentId);
    return this.vcr.capture('triggerServiceDeployment', () => this._triggerServiceDeployment(serviceId, environmentId));
  }
  private async _triggerServiceDeployment(serviceId: string, environmentId: string): Promise<void> {
    const data = await this._railwayGraphQLUser<{ serviceInstanceDeploy: boolean }>(
      `
        mutation ServiceInstanceDeploy(
          $serviceId: String!,
          $environmentId: String!,
          $latestCommit: Boolean!
        ) {
          serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId, latestCommit: $latestCommit)
        }
      `,
      { serviceId, environmentId, latestCommit: true },
    );
    if (!data.serviceInstanceDeploy) {
      throw new Error(`Failed to trigger deployment for service ${serviceId} in environment ${environmentId}`);
    }
  }

  async getServiceDomain(serviceId: string, environmentId: string): Promise<string | null> {
    if (process.env.NODE_ENV !== 'test') return this._getServiceDomain(serviceId, environmentId);
    return this.vcr.capture('getServiceDomain', () => this._getServiceDomain(serviceId, environmentId));
  }
  private async _getServiceDomain(serviceId: string, environmentId: string): Promise<string | null> {
    const data = await this._railwayGraphQLUser<{
      serviceInstance: { domains: { serviceDomains: Array<{ domain: string }> } };
    }>(
      `
        query GetServiceDomain($serviceId: String!, $environmentId: String!) {
          serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
            domains { serviceDomains { domain } }
          }
        }
      `,
      { serviceId, environmentId },
    );
    const domains = data.serviceInstance.domains.serviceDomains;
    return domains.length > 0 ? `https://${domains[0].domain}` : null;
  }

  async ensureServiceDomain(serviceId: string, environmentId: string): Promise<string> {
    if (process.env.NODE_ENV !== 'test') return this._ensureServiceDomain(serviceId, environmentId);
    return this.vcr.capture('ensureServiceDomain', () => this._ensureServiceDomain(serviceId, environmentId));
  }
  private async _ensureServiceDomain(serviceId: string, environmentId: string): Promise<string> {
    // Check if domain already exists
    const existing = await this._getServiceDomain(serviceId, environmentId);
    if (existing) return existing;

    // Create a service domain
    const data = await this._railwayGraphQLUser<{
      serviceDomainCreate: { domain: string };
    }>(
      `
        mutation ServiceDomainCreate($serviceId: String!, $environmentId: String!) {
          serviceDomainCreate(input: { serviceId: $serviceId, environmentId: $environmentId }) {
            domain
          }
        }
      `,
      { serviceId, environmentId },
    );
    return `https://${data.serviceDomainCreate.domain}`;
  }

  async setupInfisicalIntegration(
    projectId: string,
    environmentId: string,
    infisicalProjectId: string,
    infisicalEnvironment: string,
    infisicalPath: string = '/',
  ): Promise<{ id: string }> {
    if (process.env.NODE_ENV !== 'test') {
      return this._setupInfisicalIntegration(
        projectId,
        environmentId,
        infisicalProjectId,
        infisicalEnvironment,
        infisicalPath,
      );
    }
    return this.vcr.capture('setupInfisicalIntegration', () =>
      this._setupInfisicalIntegration(
        projectId,
        environmentId,
        infisicalProjectId,
        infisicalEnvironment,
        infisicalPath,
      ),
    );
  }
  private async _setupInfisicalIntegration(
    projectId: string,
    environmentId: string,
    infisicalProjectId: string,
    infisicalEnvironment: string,
    infisicalPath: string,
  ): Promise<{ id: string }> {
    const data = await this._railwayGraphQLUser<{ integrationCreate: { id: string } }>(
      `
        mutation SetupInfisicalIntegration(
          $projectId: String!,
          $environmentId: String!,
          $infisicalProjectId: String!,
          $infisicalEnvironment: String!,
          $infisicalPath: String!
        ) {
          integrationCreate(input: {
            projectId: $projectId,
            environmentId: $environmentId,
            integration: INFISICAL,
            config: {
              projectId: $infisicalProjectId,
              environment: $infisicalEnvironment,
              path: $infisicalPath
            }
          }) {
            id
          }
        }
      `,
      { projectId, environmentId, infisicalProjectId, infisicalEnvironment, infisicalPath },
    );
    return data.integrationCreate;
  }
}

export const railwayApi = new RailwayApi();
