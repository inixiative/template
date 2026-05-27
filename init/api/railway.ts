import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cliVersion, VCR } from '../../packages/shared/src/vcr';
import { getSecretAsync, setSecretAsync } from '../tasks/infisicalSetup';
import { execAsync } from '../utils/exec';
import { getProjectConfig } from '../utils/getProjectConfig';

const escapeName = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_CONFIG_PATH = join(homedir(), '.railway', 'config.json');
const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/railway');

export type RailwayWorkspace = { id: string; name: string };
export type RailwayProject = { id: string; name: string; workspaceId: string; createdAt: string };
export type RailwayService = {
  id: string;
  name: string;
  projectId: string;
  serviceInstanceId?: string;
  domains?: string[];
};
export type RailwayRedis = { id: string; name: string; projectId: string; environmentId?: string };
export type RailwayPostgres = { id: string; name: string; projectId: string; environmentId?: string };
export type RailwayDeployment = {
  id: string;
  status: 'BUILDING' | 'DEPLOYING' | 'SUCCESS' | 'FAILED' | 'CRASHED';
  url?: string;
};

class RailwayApi {
  readonly vcr = new VCR(FIXTURES_DIR, {
    service: 'railway',
    version: () => cliVersion('railway'),
    sanitizers: {
      getRedisUrl: { fn: (s) => s.replace(/:\/\/([^:]+):([^@]+)@/g, '://REDACTED:REDACTED@') },
      getPostgresUrl: { fn: (s) => s.replace(/:\/\/([^:]+):([^@]+)@/g, '://REDACTED:REDACTED@') },
      getRailwayUserToken: { fn: () => 'REDACTED' },
      getRailwayWorkspaceToken: { fn: () => 'REDACTED' },
    },
  });

  async railwayGraphQLWithToken<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read response body');
      throw new Error(
        `Railway API error: ${response.status} ${response.statusText}\nEndpoint: ${RAILWAY_API}\nResponse: ${errorBody}`,
      );
    }
    const result = (await response.json()) as { data: T; errors?: Array<{ message: string }> };
    if (result.errors && result.errors.length > 0) {
      throw new Error(`Railway GraphQL error: ${result.errors.map((e) => e.message).join(', ')}`);
    }
    return result.data;
  }

  async railwayGraphQLUser<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const token = await this.getRailwayUserToken();
    return this.railwayGraphQLWithToken<T>(token, query, variables);
  }

  async getRailwayUserToken(): Promise<string> {
    return this.vcr.capture('getRailwayUserToken', async () => {
      const config = await getProjectConfig();
      const projectId = config.infisical.projectId;
      if (!projectId) throw new Error('Infisical project not configured. Run Infisical setup first.');

      try {
        const token = await getSecretAsync('RAILWAY_USER_TOKEN', { projectId, environment: 'root' });
        if (token) return token;
      } catch (_error) {}

      try {
        await access(RAILWAY_CONFIG_PATH);
        const railwayConfig = JSON.parse(await readFile(RAILWAY_CONFIG_PATH, 'utf-8'));
        const token = railwayConfig?.user?.token;
        if (token) {
          await setSecretAsync(projectId, 'root', 'RAILWAY_USER_TOKEN', token);
          return token;
        }
      } catch (_error) {}

      throw new Error('Railway user token not found. Please run: railway login');
    });
  }

  async getRailwayWorkspaceToken(): Promise<string> {
    return this.vcr.capture('getRailwayWorkspaceToken', async () => {
      const config = await getProjectConfig();
      const projectId = config.infisical.projectId;
      if (!projectId) throw new Error('Infisical project not configured. Run Infisical setup first.');

      try {
        const token = await getSecretAsync('RAILWAY_WORKSPACE_TOKEN', { projectId, environment: 'root' });
        if (token) return token;
      } catch (_error) {}

      throw new Error(
        'Railway workspace token not found. Create one at https://railway.com/account/tokens ' +
          'and add it to Infisical root environment as RAILWAY_WORKSPACE_TOKEN',
      );
    });
  }

  async listWorkspaces(): Promise<RailwayWorkspace[]> {
    return this.vcr.capture('listWorkspaces', async () => {
      try {
        const { stdout } = await execAsync('railway whoami --json', { encoding: 'utf-8' });
        const data = JSON.parse(stdout.trim()) as { workspaces?: RailwayWorkspace[] };
        return data.workspaces ?? [];
      } catch (_error) {
        return [];
      }
    });
  }

  async createProject(workspaceId: string, name: string): Promise<RailwayProject> {
    return this.vcr.capture('createProject', async () => {
      try {
        const { stdout } = await execAsync(`railway init -n "${name}" -w "${workspaceId}" --json`, {
          encoding: 'utf-8',
        });
        const jsonLine = stdout.split('\n').find((line) => line.trim().startsWith('{'));
        if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
        const data = JSON.parse(jsonLine);
        return { id: data.id, name: data.name, workspaceId, createdAt: new Date().toISOString() };
      } catch (error) {
        if (error instanceof Error) throw new Error(`Failed to create Railway project: ${error.message}`);
        throw error;
      }
    });
  }

  async isServiceConnectedToGitHub(serviceId: string, environmentId: string): Promise<boolean> {
    return this.vcr.capture('isServiceConnectedToGitHub', async () => {
      const data = await this.railwayGraphQLUser<{
        serviceInstance: { id: string; source: { repo: string } | null } | null;
      }>(
        `
          query ServiceInstance($serviceId: String!, $environmentId: String!) {
            serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
              id
              source { repo }
            }
          }
        `,
        { serviceId, environmentId },
      );
      return !!data.serviceInstance?.source?.repo;
    });
  }

  async connectServiceToGitHub(
    serviceId: string,
    environmentId: string,
    repo: string,
    branch: string = 'main',
  ): Promise<void> {
    return this.vcr.capture('connectServiceToGitHub', async () => {
      // Two-step wiring:
      //   1. serviceInstanceUpdate sets the repo on the service's source — Railway
      //      uses this to know WHERE to fetch code from at deploy time.
      //   2. deploymentTriggerCreate creates the auto-deploy-on-push wiring with
      //      the explicit branch. Without this trigger, Railway treats the GitHub
      //      link as "connected" but never auto-deploys when commits land.
      const updateData = await this.railwayGraphQLUser<{ serviceInstanceUpdate: boolean }>(
        `
          mutation ServiceInstanceUpdate($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
            serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
          }
        `,
        { serviceId, environmentId, input: { source: { repo } } },
      );
      if (!updateData.serviceInstanceUpdate) {
        throw new Error(`Failed to set source on service ${serviceId} for ${repo} in environment ${environmentId}`);
      }

      const projectIdData = await this.railwayGraphQLUser<{ service: { projectId: string } }>(
        `query ServiceProject($id: String!) { service(id: $id) { projectId } }`,
        { id: serviceId },
      );
      const projectId = projectIdData.service.projectId;

      const existing = await this.railwayGraphQLUser<{
        deploymentTriggers: { edges: Array<{ node: { id: string; branch: string; repository: string } }> };
      }>(
        `
          query Triggers($projectId: String!, $serviceId: String!, $environmentId: String!) {
            deploymentTriggers(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId) {
              edges { node { id branch repository } }
            }
          }
        `,
        { projectId, serviceId, environmentId },
      );
      const hasTrigger = existing.deploymentTriggers.edges.some(
        (e) => e.node.repository === repo && e.node.branch === branch,
      );
      if (!hasTrigger) {
        await this.railwayGraphQLUser<{ deploymentTriggerCreate: { id: string } }>(
          `
            mutation TriggerCreate($input: DeploymentTriggerCreateInput!) {
              deploymentTriggerCreate(input: $input) { id }
            }
          `,
          {
            input: {
              projectId,
              environmentId,
              serviceId,
              provider: 'github',
              repository: repo,
              branch,
              checkSuites: false,
            },
          },
        );
      }
    });
  }

  async renameService(serviceId: string, name: string): Promise<void> {
    return this.vcr.capture('renameService', async () => {
      await this.railwayGraphQLUser<{ serviceUpdate: { id: string; name: string } }>(
        `
          mutation ServiceUpdate($id: String!, $input: ServiceUpdateInput!) {
            serviceUpdate(id: $id, input: $input) { id name }
          }
        `,
        { id: serviceId, input: { name } },
      );
    });
  }

  async updateServiceInstanceConfig(
    serviceId: string,
    environmentId: string,
    input: { rootDirectory?: string; buildCommand?: string; startCommand?: string },
  ): Promise<void> {
    return this.vcr.capture('updateServiceInstanceConfig', async () => {
      const data = await this.railwayGraphQLUser<{ serviceInstanceUpdate: boolean }>(
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
    });
  }

  async getProjectVolumes(projectId: string): Promise<Array<{ id: string; name: string }>> {
    return this.vcr.capture('getProjectVolumes', async () => {
      const data = await this.railwayGraphQLUser<{
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
    });
  }

  async getServiceVolume(projectId: string, serviceName: string): Promise<{ id: string; name: string } | null> {
    return this.vcr.capture('getServiceVolume', async () => {
      const volumes = await this.getProjectVolumes(projectId);
      if (volumes.length === 0) return null;
      // Match by name first (works after volumes are renamed in earlier steps)
      const match = volumes.find((v) => v.name.includes(serviceName));
      if (match) return match;
      // Fallback: return the last volume (works when there's only one or volumes haven't been renamed yet)
      return volumes[volumes.length - 1];
    });
  }

  async renameVolume(volumeId: string, name: string): Promise<void> {
    return this.vcr.capture('renameVolume', async () => {
      await this.railwayGraphQLUser<{ volumeUpdate: { id: string; name: string } }>(
        `
          mutation VolumeUpdate($volumeId: String!, $input: VolumeUpdateInput!) {
            volumeUpdate(volumeId: $volumeId, input: $input) { id name }
          }
        `,
        { volumeId, input: { name } },
      );
    });
  }

  async createService(
    projectId: string,
    _environmentId: string,
    environmentName: string,
    name: string,
  ): Promise<RailwayService> {
    return this.vcr.capture('createService', async () => {
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
      const jsonLine = stdout.split('\n').find((line) => line.trim().startsWith('{'));
      if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
      const data = JSON.parse(jsonLine);
      return { id: data.id || data.serviceId, name: data.name || name, projectId };
    });
  }

  async getProjectEnvironments(projectId: string): Promise<Array<{ id: string; name: string }>> {
    return this.vcr.capture('getProjectEnvironments', async () => {
      const data = await this.railwayGraphQLUser<{
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
    });
  }

  async createEnvironment(
    projectId: string,
    name: string,
    sourceEnvironmentId?: string,
  ): Promise<{ id: string; name: string }> {
    return this.vcr.capture('createEnvironment', async () => {
      try {
        const duplicateFlag = sourceEnvironmentId ? `--duplicate ${sourceEnvironmentId}` : '';
        const { stdout } = await execAsync(`railway environment new "${escapeName(name)}" ${duplicateFlag} --json`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
        });
        const jsonLine = stdout.split('\n').find((line) => line.trim().startsWith('{'));
        if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
        const data = JSON.parse(jsonLine);
        return { id: data.id || data.environmentId, name: data.name || name };
      } catch (error) {
        if (error instanceof Error) throw new Error(`Failed to create environment: ${error.message}`);
        throw error;
      }
    });
  }

  async deleteEnvironment(projectId: string, environmentName: string): Promise<void> {
    return this.vcr.capture('deleteEnvironment', async () => {
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
    });
  }

  async renameEnvironment(environmentId: string, newName: string): Promise<boolean> {
    return this.vcr.capture('renameEnvironment', async () => {
      const data = await this.railwayGraphQLUser<{ environmentRename: boolean }>(
        `
          mutation RenameEnvironment($id: String!, $name: String!) {
            environmentRename(id: $id, input: { name: $name })
          }
        `,
        { id: environmentId, name: newName },
      );
      return data.environmentRename;
    });
  }

  async createRedis(projectId: string, environmentId: string, environmentName: string): Promise<RailwayRedis> {
    return this.vcr.capture('createRedis', async () => {
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
        const jsonLine = stdout.split('\n').find((line) => line.trim().startsWith('{'));
        if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
        const data = JSON.parse(jsonLine);
        return { id: data.serviceId || data.id, name: data.name || 'redis', projectId, environmentId };
      } catch (error) {
        if (error instanceof Error) throw new Error(`Failed to provision Redis: ${error.message}`);
        throw error;
      }
    });
  }

  async getRedisUrl(
    serviceId: string,
    _environmentId: string,
    environmentName: string,
    projectId: string,
  ): Promise<string> {
    return this.vcr.capture('getRedisUrl', async () => {
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
    });
  }

  async createPostgres(projectId: string, environmentId: string, environmentName: string): Promise<RailwayPostgres> {
    return this.vcr.capture('createPostgres', async () => {
      try {
        await execAsync(`railway environment link "${escapeName(environmentName)}"`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
        });
        const { stdout } = await execAsync(`railway add -d postgres --json`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
        });
        const jsonLine = stdout.split('\n').find((line) => line.trim().startsWith('{'));
        if (!jsonLine) throw new Error(`No JSON output found. Raw output: ${stdout}`);
        const data = JSON.parse(jsonLine);
        return { id: data.serviceId || data.id, name: data.name || 'postgres', projectId, environmentId };
      } catch (error) {
        if (error instanceof Error) throw new Error(`Failed to provision Postgres: ${error.message}`);
        throw error;
      }
    });
  }

  async getPostgresUrl(
    serviceId: string,
    _environmentId: string,
    environmentName: string,
    projectId: string,
  ): Promise<string> {
    return this.vcr.capture('getPostgresUrl', async () => {
      try {
        const { stdout } = await execAsync(`railway variables list -s ${serviceId} -e ${environmentName} --json`, {
          encoding: 'utf-8',
          cwd: process.cwd(),
          env: { ...process.env, RAILWAY_PROJECT_ID: projectId },
        });
        const variables = JSON.parse(stdout.trim());
        // Prefer the private URL (Railway-internal network, faster + free egress).
        const url = variables.DATABASE_PRIVATE_URL || variables.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL not found in service variables');
        return url;
      } catch (error) {
        if (error instanceof Error) throw new Error(`Failed to get Postgres URL: ${error.message}`);
        throw error;
      }
    });
  }

  async setEnvironmentVariables(
    serviceId: string,
    environmentId: string,
    variables: Record<string, string>,
  ): Promise<void> {
    return this.vcr.capture('setEnvironmentVariables', async () => {
      await this.railwayGraphQLUser<{ variableCollectionUpsert: { id: string } }>(
        `
          mutation SetVariables($serviceId: String!, $environmentId: String!, $variables: String!) {
            variableCollectionUpsert(input: { serviceId: $serviceId, environmentId: $environmentId, variables: $variables }) {
              id
            }
          }
        `,
        { serviceId, environmentId, variables: JSON.stringify(variables) },
      );
    });
  }

  async getLatestDeployment(serviceId: string, environmentId: string): Promise<RailwayDeployment | null> {
    return this.vcr.capture('getLatestDeployment', async () => {
      const data = await this.railwayGraphQLUser<{
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
    });
  }

  async triggerServiceDeployment(serviceId: string, environmentId: string): Promise<void> {
    return this.vcr.capture('triggerServiceDeployment', async () => {
      const data = await this.railwayGraphQLUser<{ serviceInstanceDeploy: boolean }>(
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
    });
  }

  async getServiceDomain(serviceId: string, environmentId: string): Promise<string | null> {
    return this.vcr.capture('getServiceDomain', async () => {
      const data = await this.railwayGraphQLUser<{
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
    });
  }

  async ensureServiceDomain(serviceId: string, environmentId: string): Promise<string> {
    return this.vcr.capture('ensureServiceDomain', async () => {
      const existing = await this.getServiceDomain(serviceId, environmentId);
      if (existing) return existing;

      const data = await this.railwayGraphQLUser<{ serviceDomainCreate: { domain: string } }>(
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
    });
  }

  async setupInfisicalIntegration(
    projectId: string,
    environmentId: string,
    infisicalProjectId: string,
    infisicalEnvironment: string,
    infisicalPath: string = '/',
  ): Promise<{ id: string }> {
    return this.vcr.capture('setupInfisicalIntegration', async () => {
      const data = await this.railwayGraphQLUser<{ integrationCreate: { id: string } }>(
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
    });
  }

  async getProjectBuckets(projectId: string): Promise<Array<{ id: string; name: string }>> {
    return this.vcr.capture('getProjectBuckets', async () => {
      const data = await this.railwayGraphQLUser<{
        project: { buckets: Array<{ id: string; name: string }> };
      }>(
        `
          query ProjectBuckets($id: String!) {
            project(id: $id) {
              buckets { id name }
            }
          }
        `,
        { id: projectId },
      );
      return data.project.buckets ?? [];
    });
  }

  async createBucket(projectId: string, name: string): Promise<{ id: string; name: string }> {
    return this.vcr.capture('createBucket', async () => {
      const data = await this.railwayGraphQLUser<{
        bucketCreate: { id: string; name: string; projectId: string };
      }>(
        `
          mutation BucketCreate($input: BucketCreateInput!) {
            bucketCreate(input: $input) {
              id
              name
              projectId
            }
          }
        `,
        { input: { projectId, name } },
      );
      return { id: data.bucketCreate.id, name: data.bucketCreate.name };
    });
  }

  async ensureBucket(projectId: string, name: string): Promise<{ id: string; name: string }> {
    return this.vcr.capture('ensureBucket', async () => {
      const existing = (await this.getProjectBuckets(projectId)).find((b) => b.name === name);
      if (existing) return existing;
      return this.createBucket(projectId, name);
    });
  }

  async getBucketCredentials(
    bucketId: string,
    environmentId: string,
    projectId: string,
  ): Promise<{
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    endpoint: string;
    urlStyle: string;
  }> {
    return this.vcr.capture('getBucketCredentials', async () => {
      const data = await this.railwayGraphQLUser<{
        bucketS3Credentials: {
          accessKeyId: string;
          bucketName: string;
          endpoint: string;
          region: string;
          secretAccessKey: string;
          urlStyle: string;
        };
      }>(
        `
          query BucketS3Credentials($bucketId: String!, $environmentId: String!, $projectId: String!) {
            bucketS3Credentials(bucketId: $bucketId, environmentId: $environmentId, projectId: $projectId) {
              accessKeyId
              bucketName
              endpoint
              region
              secretAccessKey
              urlStyle
            }
          }
        `,
        { bucketId, environmentId, projectId },
      );
      const creds = data.bucketS3Credentials;
      if (!creds?.bucketName || !creds?.accessKeyId) {
        throw new Error('Bucket credentials not ready');
      }
      return {
        bucket: creds.bucketName,
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        region: creds.region,
        endpoint: creds.endpoint,
        urlStyle: creds.urlStyle,
      };
    });
  }
}

export const railwayApi = new RailwayApi();
