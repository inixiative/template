import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Check if a GitHub App is installed on an organization
 * @param org - GitHub organization name
 * @param appSlug - GitHub App slug (e.g., 'vercel', 'railway-app')
 * @returns true if app is installed, false otherwise
 */
export const isAppInstalled = async (org: string, appSlug: string): Promise<boolean> => {
  try {
    const { stdout } = await execAsync(
      `gh api /orgs/${org}/installations --jq '.installations[] | select(.app_slug == "${appSlug}") | .id'`,
      { encoding: 'utf-8' },
    );

    // If we get an installation ID, app is installed
    return stdout.trim() !== '';
  } catch (_error) {
    // If command fails, assume not installed
    return false;
  }
};

/**
 * Get installation ID for a GitHub App on an organization
 * @param org - GitHub organization name
 * @param appSlug - GitHub App slug (e.g., 'vercel', 'railway-app')
 * @returns installation ID if found, null otherwise
 */
export const getAppInstallationId = async (org: string, appSlug: string): Promise<string | null> => {
  try {
    const { stdout } = await execAsync(
      `gh api /orgs/${org}/installations --jq '.installations[] | select(.app_slug == "${appSlug}") | .id'`,
      { encoding: 'utf-8' },
    );

    const installationId = stdout.trim();
    return installationId !== '' ? installationId : null;
  } catch (_error) {
    return null;
  }
};

/**
 * List all GitHub Apps installed on an organization
 * @param org - GitHub organization name
 * @returns array of installed apps with id and slug
 */
export const listInstalledApps = async (org: string): Promise<Array<{ id: string; slug: string }>> => {
  try {
    const { stdout } = await execAsync(
      `gh api /orgs/${org}/installations --jq '.installations[] | {id: .id, slug: .app_slug}'`,
      { encoding: 'utf-8' },
    );

    const lines = stdout
      .trim()
      .split('\n')
      .filter((line) => line);
    return lines.map((line) => JSON.parse(line));
  } catch (_error) {
    return [];
  }
};
