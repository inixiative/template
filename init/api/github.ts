import { join } from 'path';
import { VCR } from '../../packages/shared/src/vcr';
import { execAsync } from '../utils/exec';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/github');

class GitHubApi {
  readonly vcr = new VCR(FIXTURES_DIR);

  /**
   * Check if a GitHub App is installed on an organization
   */
  async isAppInstalled(org: string, appSlug: string): Promise<boolean> {
    if (process.env.NODE_ENV !== 'test') return this._isAppInstalled(org, appSlug);
    return this.vcr.capture('isAppInstalled', () => this._isAppInstalled(org, appSlug));
  }
  private async _isAppInstalled(org: string, appSlug: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `gh api /orgs/${org}/installations --jq '.installations[] | select(.app_slug == "${appSlug}") | .id'`,
        { encoding: 'utf-8' },
      );
      return stdout.trim() !== '';
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get installation ID for a GitHub App on an organization
   */
  async getAppInstallationId(org: string, appSlug: string): Promise<string | null> {
    if (process.env.NODE_ENV !== 'test') return this._getAppInstallationId(org, appSlug);
    return this.vcr.capture('getAppInstallationId', () => this._getAppInstallationId(org, appSlug));
  }
  private async _getAppInstallationId(org: string, appSlug: string): Promise<string | null> {
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
  }

  /**
   * List all GitHub Apps installed on an organization
   */
  async listInstalledApps(org: string): Promise<Array<{ id: string; slug: string }>> {
    if (process.env.NODE_ENV !== 'test') return this._listInstalledApps(org);
    return this.vcr.capture('listInstalledApps', () => this._listInstalledApps(org));
  }
  private async _listInstalledApps(org: string): Promise<Array<{ id: string; slug: string }>> {
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
  }
}

export const githubApi = new GitHubApi();
