import { join } from 'path';
import { cliVersion, VCR } from '../../packages/shared/src/vcr';
import { execAsync } from '../utils/exec';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/vercel');

export type VercelTeam = { id: string; name: string; slug: string };
export type VercelProject = { id: string; name: string; framework: string | null };

class VercelApi {
  readonly vcr = new VCR(FIXTURES_DIR, { service: 'vercel', version: () => cliVersion('vercel') });

  async getVercelToken(): Promise<string> {
    const { homedir } = await import('node:os');
    const path = await import('node:path');
    const { readFile } = await import('node:fs/promises');
    const authPath = path.join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
    const auth = JSON.parse(await readFile(authPath, 'utf-8'));
    return auth.token;
  }

  async vercelAPI(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const token = await this.getVercelToken();
    const url = `https://api.vercel.com${endpoint}`;
    const headers = [`-H "Authorization: Bearer ${token}"`, `-H "Content-Type: application/json"`].join(' ');
    const cmd = body
      ? `curl -s -X ${method} "${url}" ${headers} -d '${JSON.stringify(body)}'`
      : `curl -s "${url}" ${headers}`;
    const { stdout } = await execAsync(cmd);
    return JSON.parse(stdout);
  }

  async listTeams(): Promise<VercelTeam[]> {
    return this.vcr.capture('listTeams', async () => {
      try {
        const result = await this.vercelAPI('/v2/teams', 'GET');
        if (result.error) return [];
        return ((result.teams ?? []) as Array<{ id: string; name: string; slug: string }>).map((team) => ({
          id: team.id,
          name: team.name,
          slug: team.slug,
        }));
      } catch (_error) {
        return [];
      }
    });
  }

  async getProject(projectName: string, teamId?: string): Promise<VercelProject | null> {
    return this.vcr.capture('getProject', async () => {
      try {
        const teamFlag = teamId ? `--scope ${teamId}` : '';
        const { stdout, stderr } = await execAsync(`vercel project inspect ${projectName} ${teamFlag}`, {
          encoding: 'utf-8',
        });
        const output = stdout + stderr;
        const idMatch = output.match(/ID\s+([a-zA-Z0-9_]+)/);
        const nameMatch = output.match(/Name\s+([^\s]+)/);
        if (!idMatch) return null;
        return { id: idMatch[1], name: nameMatch ? nameMatch[1] : projectName, framework: null };
      } catch (_error) {
        return null;
      }
    });
  }

  async createProject(projectName: string, teamId?: string): Promise<VercelProject> {
    return this.vcr.capture('createProject', async () => {
      try {
        const teamFlag = teamId ? `--scope ${teamId}` : '';
        await execAsync(`vercel project add ${projectName} ${teamFlag}`, { encoding: 'utf-8' });
        const projectInfo = await this.getProject(projectName, teamId);
        if (!projectInfo) throw new Error('Project created but could not retrieve project info');
        return projectInfo;
      } catch (error) {
        if (error instanceof Error) throw new Error(`Failed to create Vercel project: ${error.message}`);
        throw error;
      }
    });
  }

  async checkGitHubIntegration(): Promise<unknown> {
    return this.vcr.capture('checkGitHubIntegration', async () => {
      try {
        return await this.vercelAPI('/v1/integrations/git-namespaces?provider=github', 'GET');
      } catch (_error) {
        return null;
      }
    });
  }

  async findGitHubNamespace(orgName: string): Promise<string | null> {
    return this.vcr.capture('findGitHubNamespace', async () => {
      const integrations = await this.checkGitHubIntegration();
      if (!integrations || !Array.isArray(integrations)) return null;
      const namespace = integrations.find(
        (ns: unknown) => (ns as { name?: string }).name?.toLowerCase() === orgName.toLowerCase(),
      );
      return (namespace as { id?: unknown } | undefined)?.id?.toString() ?? null;
    });
  }

  async linkGitHub(
    projectId: string,
    org: string,
    repo: string,
    branch: string = 'main',
    teamId?: string,
  ): Promise<void> {
    return this.vcr.capture('linkGitHub', async () => {
      try {
        const teamFlag = teamId ? `--scope ${teamId}` : '';
        await execAsync(`vercel link --project ${projectId} ${teamFlag} --yes`, { encoding: 'utf-8' });
        const gitUrl = `https://github.com/${org}/${repo}`;
        const { stdout, stderr } = await execAsync(`echo y | vercel git connect ${gitUrl} ${teamFlag}`, {
          encoding: 'utf-8',
          timeout: 30000,
          shell: '/bin/bash',
        });
        const output = stdout + stderr;
        if (output.toLowerCase().includes('error:') || stderr.toLowerCase().includes('error:')) {
          throw new Error(output || 'Failed to connect GitHub repository');
        }
      } catch (error) {
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('install') || msg.includes('integration')) throw new Error('GITHUB_NOT_INSTALLED');
          if (msg.includes('login connection')) throw new Error('GITHUB_LOGIN_CONNECTION_REQUIRED');
          throw error;
        }
        throw new Error('Failed to link GitHub repository');
      }
    });
  }

  async addEnvVar(
    projectName: string,
    key: string,
    value: string,
    environment: 'production' | 'preview' | 'development',
    teamId?: string,
  ): Promise<void> {
    return this.vcr.capture('addEnvVar', async () => {
      try {
        const teamFlag = teamId ? `--scope ${teamId}` : '';
        const escapedValue = value.replace(/'/g, `'"'"'`);
        await execAsync(
          `printf '%s\\n' '${escapedValue}' | vercel env add ${key} ${environment} --project ${projectName} ${teamFlag} --yes`,
          { encoding: 'utf-8' },
        );
      } catch (error) {
        if (error instanceof Error) throw new Error(`Failed to add environment variable ${key}: ${error.message}`);
        throw error;
      }
    });
  }

  async updateProjectSettings(
    projectId: string,
    teamId: string,
    settings: {
      rootDirectory?: string;
      buildCommand?: string | null;
      framework?: string | null;
      git?: { deploymentEnabled?: Record<string, boolean> };
    },
  ): Promise<void> {
    return this.vcr.capture('updateProjectSettings', async () => {
      const result = await this.vercelAPI(`/v10/projects/${projectId}?teamId=${teamId}`, 'PATCH', settings);
      if (result.error) {
        const err = result.error as Record<string, unknown>;
        const msg = err.message ?? err.code ?? JSON.stringify(result.error);
        throw new Error(`Failed to update project settings: ${msg}`);
      }
    });
  }

  async createCustomEnvironment(
    projectId: string,
    teamId: string,
    environmentName: string,
    trackedBranch: string,
  ): Promise<string> {
    return this.vcr.capture('createCustomEnvironment', async () => {
      const result = await this.vercelAPI(`/v9/projects/${projectId}/custom-environments?teamId=${teamId}`, 'POST', {
        slug: environmentName.toLowerCase(),
        description: `${environmentName} environment`,
        branchMatcher: { type: 'equals', pattern: trackedBranch },
      });
      if (result.error) {
        const err = result.error as Record<string, unknown>;
        const msg = err.message ?? err.code ?? JSON.stringify(result.error);
        throw new Error(`Failed to create custom environment: ${msg}`);
      }
      return result.id as string;
    });
  }

  async deploy(
    projectPath: string,
    production: boolean = false,
    teamId?: string,
  ): Promise<{ url: string; deploymentId: string }> {
    return this.vcr.capture('deploy', async () => {
      try {
        const teamFlag = teamId ? `--scope ${teamId}` : '';
        const prodFlag = production ? '--prod' : '';
        const { stdout } = await execAsync(`vercel deploy ${projectPath} ${prodFlag} ${teamFlag} --json`, {
          encoding: 'utf-8',
        });
        const data = JSON.parse(stdout.trim());
        return { url: data.url, deploymentId: data.id };
      } catch (error) {
        if (error instanceof Error) throw new Error(`Failed to deploy project: ${error.message}`);
        throw error;
      }
    });
  }
}

export const vercelApi = new VercelApi();
