import { join } from 'path';
import { VCR } from '../../packages/shared/src/vcr';
import { execAsync } from '../utils/exec';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/vercel');

export type VercelTeam = {
  id: string;
  name: string;
  slug: string;
};

export type VercelProject = {
  id: string;
  name: string;
  framework: string | null;
};

class VercelApi {
  readonly vcr = new VCR(FIXTURES_DIR);

  /**
   * Get Vercel API token from CLI config
   */
  private async _getVercelToken(): Promise<string> {
    const { homedir } = await import('node:os');
    const path = await import('node:path');
    const { readFile } = await import('node:fs/promises');

    const authPath = path.join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
    const content = await readFile(authPath, 'utf-8');
    const auth = JSON.parse(content);
    return auth.token;
  }

  /**
   * Make Vercel API request
   */
  private async _vercelAPI(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const token = await this._getVercelToken();
    const url = `https://api.vercel.com${endpoint}`;

    const headers = [`-H "Authorization: Bearer ${token}"`, `-H "Content-Type: application/json"`].join(' ');

    const cmd = body
      ? `curl -s -X ${method} "${url}" ${headers} -d '${JSON.stringify(body)}'`
      : `curl -s "${url}" ${headers}`;

    const { stdout } = await execAsync(cmd);
    return JSON.parse(stdout);
  }

  /**
   * List all teams/orgs for the authenticated user
   */
  async listTeams(): Promise<VercelTeam[]> {
    if (process.env.NODE_ENV !== 'test') return this._listTeams();
    return this.vcr.capture('listTeams', () => this._listTeams());
  }
  private async _listTeams(): Promise<VercelTeam[]> {
    try {
      const result = await this._vercelAPI('/v2/teams', 'GET');

      if (result.error) {
        return [];
      }

      const teams: VercelTeam[] = ((result.teams ?? []) as Array<{ id: string; name: string; slug: string }>).map(
        (team) => ({
          id: team.id,
          name: team.name,
          slug: team.slug,
        }),
      );

      return teams;
    } catch (error) {
      return [];
    }
  }

  /**
   * Create a new Vercel project
   */
  async createProject(projectName: string, teamId?: string): Promise<VercelProject> {
    if (process.env.NODE_ENV !== 'test') return this._createProject(projectName, teamId);
    return this.vcr.capture('createProject', () => this._createProject(projectName, teamId));
  }
  private async _createProject(projectName: string, teamId?: string): Promise<VercelProject> {
    try {
      const teamFlag = teamId ? `--scope ${teamId}` : '';
      const { stdout, stderr } = await execAsync(`vercel project add ${projectName} ${teamFlag}`, {
        encoding: 'utf-8',
      });

      const _output = stdout + stderr;

      const projectInfo = await this._getProject(projectName, teamId);

      if (!projectInfo) {
        throw new Error('Project created but could not retrieve project info');
      }

      return projectInfo;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create Vercel project: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get project details using inspect command
   */
  async getProject(projectName: string, teamId?: string): Promise<VercelProject | null> {
    if (process.env.NODE_ENV !== 'test') return this._getProject(projectName, teamId);
    return this.vcr.capture('getProject', () => this._getProject(projectName, teamId));
  }
  private async _getProject(projectName: string, teamId?: string): Promise<VercelProject | null> {
    try {
      const teamFlag = teamId ? `--scope ${teamId}` : '';
      const { stdout, stderr } = await execAsync(`vercel project inspect ${projectName} ${teamFlag}`, {
        encoding: 'utf-8',
      });

      const output = stdout + stderr;

      const idMatch = output.match(/ID\s+([a-zA-Z0-9_]+)/);
      const nameMatch = output.match(/Name\s+([^\s]+)/);

      if (!idMatch) {
        return null;
      }

      return {
        id: idMatch[1],
        name: nameMatch ? nameMatch[1] : projectName,
        framework: null,
      };
    } catch (_error) {
      return null;
    }
  }

  /**
   * Check GitHub integrations for the team
   */
  async checkGitHubIntegration(): Promise<unknown> {
    if (process.env.NODE_ENV !== 'test') return this._checkGitHubIntegration();
    return this.vcr.capture('checkGitHubIntegration', () => this._checkGitHubIntegration());
  }
  private async _checkGitHubIntegration(): Promise<unknown> {
    try {
      const endpoint = `/v1/integrations/git-namespaces?provider=github`;
      const result = await this._vercelAPI(endpoint, 'GET');
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find GitHub namespace ID for a given organization
   */
  async findGitHubNamespace(orgName: string): Promise<string | null> {
    if (process.env.NODE_ENV !== 'test') return this._findGitHubNamespace(orgName);
    return this.vcr.capture('findGitHubNamespace', () => this._findGitHubNamespace(orgName));
  }
  private async _findGitHubNamespace(orgName: string): Promise<string | null> {
    const integrations = await this._checkGitHubIntegration();

    if (!integrations || !Array.isArray(integrations)) {
      return null;
    }

    const namespace = integrations.find(
      (ns: unknown) => (ns as { name?: string }).name?.toLowerCase() === orgName.toLowerCase(),
    );

    return (namespace as { id?: unknown } | undefined)?.id?.toString() ?? null;
  }

  /**
   * Link GitHub repository to project using Vercel CLI
   */
  async linkGitHub(
    projectId: string,
    org: string,
    repo: string,
    branch: string = 'main',
    teamId?: string,
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._linkGitHub(projectId, org, repo, branch, teamId);
    return this.vcr.capture('linkGitHub', () => this._linkGitHub(projectId, org, repo, branch, teamId));
  }
  private async _linkGitHub(
    projectId: string,
    org: string,
    repo: string,
    branch: string = 'main',
    teamId?: string,
  ): Promise<void> {
    try {
      const teamFlag = teamId ? `--scope ${teamId}` : '';

      const { stdout: linkOut, stderr: linkErr } = await execAsync(
        `vercel link --project ${projectId} ${teamFlag} --yes`,
        { encoding: 'utf-8' },
      );

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
        if (msg.includes('install') || msg.includes('integration')) {
          throw new Error('GITHUB_NOT_INSTALLED');
        }
        if (msg.includes('login connection')) {
          throw new Error('GITHUB_LOGIN_CONNECTION_REQUIRED');
        }
        throw error;
      }
      throw new Error('Failed to link GitHub repository');
    }
  }

  /**
   * Add environment variable to a project
   */
  async addEnvVar(
    projectName: string,
    key: string,
    value: string,
    environment: 'production' | 'preview' | 'development',
    teamId?: string,
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._addEnvVar(projectName, key, value, environment, teamId);
    return this.vcr.capture('addEnvVar', () => this._addEnvVar(projectName, key, value, environment, teamId));
  }
  private async _addEnvVar(
    projectName: string,
    key: string,
    value: string,
    environment: 'production' | 'preview' | 'development',
    teamId?: string,
  ): Promise<void> {
    try {
      const teamFlag = teamId ? `--scope ${teamId}` : '';
      const escapedValue = value.replace(/'/g, `'"'"'`);
      await execAsync(
        `printf '%s\\n' '${escapedValue}' | vercel env add ${key} ${environment} --project ${projectName} ${teamFlag} --yes`,
        {
          encoding: 'utf-8',
        },
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to add environment variable ${key}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update project settings (root directory, framework, etc.)
   */
  async updateProjectSettings(
    projectId: string,
    teamId: string,
    settings: {
      rootDirectory?: string;
      buildCommand?: string | null;
      framework?: string | null;
      git?: {
        deploymentEnabled?: Record<string, boolean>;
      };
    },
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return this._updateProjectSettings(projectId, teamId, settings);
    return this.vcr.capture('updateProjectSettings', () =>
      this._updateProjectSettings(projectId, teamId, settings),
    );
  }
  private async _updateProjectSettings(
    projectId: string,
    teamId: string,
    settings: {
      rootDirectory?: string;
      buildCommand?: string | null;
      framework?: string | null;
      git?: {
        deploymentEnabled?: Record<string, boolean>;
      };
    },
  ): Promise<void> {
    const endpoint = `/v10/projects/${projectId}?teamId=${teamId}`;

    const result = await this._vercelAPI(endpoint, 'PATCH', settings);

    if (result.error) {
      const err = result.error as Record<string, unknown>;
      const msg = err.message ?? err.code ?? JSON.stringify(result.error);
      throw new Error(`Failed to update project settings: ${msg}`);
    }
  }

  /**
   * Create custom environment for a project
   */
  async createCustomEnvironment(
    projectId: string,
    teamId: string,
    environmentName: string,
    trackedBranch: string,
  ): Promise<string> {
    if (process.env.NODE_ENV !== 'test')
      return this._createCustomEnvironment(projectId, teamId, environmentName, trackedBranch);
    return this.vcr.capture('createCustomEnvironment', () =>
      this._createCustomEnvironment(projectId, teamId, environmentName, trackedBranch),
    );
  }
  private async _createCustomEnvironment(
    projectId: string,
    teamId: string,
    environmentName: string,
    trackedBranch: string,
  ): Promise<string> {
    const endpoint = `/v9/projects/${projectId}/custom-environments?teamId=${teamId}`;

    const result = await this._vercelAPI(endpoint, 'POST', {
      slug: environmentName.toLowerCase(),
      description: `${environmentName} environment`,
      branchMatcher: {
        type: 'equals',
        pattern: trackedBranch,
      },
    });

    if (result.error) {
      const err = result.error as Record<string, unknown>;
      const msg = err.message ?? err.code ?? JSON.stringify(result.error);
      throw new Error(`Failed to create custom environment: ${msg}`);
    }

    return result.id as string;
  }

  /**
   * Deploy a project
   */
  async deploy(
    projectPath: string,
    production: boolean = false,
    teamId?: string,
  ): Promise<{ url: string; deploymentId: string }> {
    if (process.env.NODE_ENV !== 'test') return this._deploy(projectPath, production, teamId);
    return this.vcr.capture('deploy', () => this._deploy(projectPath, production, teamId));
  }
  private async _deploy(
    projectPath: string,
    production: boolean = false,
    teamId?: string,
  ): Promise<{ url: string; deploymentId: string }> {
    try {
      const teamFlag = teamId ? `--scope ${teamId}` : '';
      const prodFlag = production ? '--prod' : '';
      const { stdout } = await execAsync(`vercel deploy ${projectPath} ${prodFlag} ${teamFlag} --json`, {
        encoding: 'utf-8',
      });

      const data = JSON.parse(stdout.trim());
      return {
        url: data.url,
        deploymentId: data.id,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to deploy project: ${error.message}`);
      }
      throw error;
    }
  }
}

export const vercelApi = new VercelApi();
