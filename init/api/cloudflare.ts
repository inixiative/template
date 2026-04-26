/**
 * Cloudflare API v4 client — Pages-focused.
 *
 * Auth: requires CLOUDFLARE_API_TOKEN with at least these permissions:
 *   - Account: Cloudflare Pages: Edit
 *   - Account: Account Settings: Read
 *   - User: User Details: Read
 *
 * The token is the user's responsibility to create at
 *   https://dash.cloudflare.com/profile/api-tokens
 * and is captured during init via the CloudflarePagesSetupView, then stored
 * in Infisical at root /CLOUDFLARE_API_TOKEN. Subsequent calls read it from
 * the env at task-runtime.
 */

const CF_API = 'https://api.cloudflare.com/client/v4';

export type CFAccount = { id: string; name: string };

export type CFPagesProject = {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  source?: { type: 'github'; config: { owner: string; repo_name: string; production_branch: string } };
};

const requireToken = (): string => {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN missing — set it via Cloudflare Pages Setup → Store API token.');
  return token;
};

const cfFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = requireToken();
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as { success: boolean; result: T; errors: Array<{ message: string }> };
  if (!res.ok || !body.success) {
    const msg = body.errors?.[0]?.message ?? `Cloudflare ${path} failed: ${res.status}`;
    throw new Error(msg);
  }
  return body.result;
};

export const cloudflareApi = {
  /** List accounts the token can see. Most users have exactly one. */
  async listAccounts(): Promise<CFAccount[]> {
    return cfFetch<CFAccount[]>('/accounts?per_page=50');
  },

  /** Verify the token works + fetch its associated user. */
  async verifyToken(): Promise<{ id: string; status: string }> {
    return cfFetch<{ id: string; status: string }>('/user/tokens/verify');
  },

  async getProject(accountId: string, projectName: string): Promise<CFPagesProject | null> {
    try {
      return await cfFetch<CFPagesProject>(`/accounts/${accountId}/pages/projects/${projectName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      if (msg.includes('not found') || msg.includes('does not exist')) return null;
      throw e;
    }
  },

  /**
   * Create a Pages project linked to a GitHub repo. CF doesn't have a
   * separate "link" step — the source is set at create time.
   */
  async createProjectFromGitHub(
    accountId: string,
    projectName: string,
    args: {
      githubOwner: string;
      githubRepo: string;
      productionBranch: string;
      rootDir: string; // e.g. "apps/superadmin"
      buildCommand: string; // e.g. "bun install && bun run --cwd apps/superadmin build"
      destinationDir: string; // relative to repo root, e.g. "apps/superadmin/dist"
    },
  ): Promise<CFPagesProject> {
    const body = {
      name: projectName,
      production_branch: args.productionBranch,
      source: {
        type: 'github',
        config: {
          owner: args.githubOwner,
          repo_name: args.githubRepo,
          production_branch: args.productionBranch,
          pr_comments_enabled: true,
          deployments_enabled: true,
          production_deployment_enabled: true,
          preview_deployment_setting: 'all',
          preview_branch_includes: ['*'],
          preview_branch_excludes: [args.productionBranch],
          path_excludes: [],
          path_includes: ['*'],
        },
      },
      build_config: {
        build_command: args.buildCommand,
        destination_dir: args.destinationDir,
        root_dir: args.rootDir,
        web_analytics_tag: null,
        web_analytics_token: null,
      },
    };
    return cfFetch<CFPagesProject>(`/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * Set deployment env vars for a Pages project. Replaces the env block
   * for the given environment ('production' or 'preview' — staging maps
   * to the preview environment in CF Pages' two-tier model).
   */
  async setDeploymentEnvVars(
    accountId: string,
    projectName: string,
    environment: 'production' | 'preview',
    envVars: Record<string, string>,
  ): Promise<CFPagesProject> {
    const env_vars: Record<string, { value: string; type: 'plain_text' }> = {};
    for (const [k, v] of Object.entries(envVars)) {
      env_vars[k] = { value: v, type: 'plain_text' };
    }
    const body = {
      deployment_configs: {
        [environment]: { env_vars },
      },
    };
    return cfFetch<CFPagesProject>(`/accounts/${accountId}/pages/projects/${projectName}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};
