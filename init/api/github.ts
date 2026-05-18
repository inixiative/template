import { join } from 'path';
import { cliVersion, VCR } from '../../packages/shared/src/vcr';
import { execAsync } from '../utils/exec';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/github');

class GitHubApi {
  readonly vcr = new VCR(FIXTURES_DIR, { service: 'github', version: () => cliVersion('gh') });

  async isAppInstalled(org: string, appSlug: string): Promise<boolean> {
    return this.vcr.capture('isAppInstalled', async () => {
      try {
        const { stdout } = await execAsync(
          `gh api /orgs/${org}/installations --jq '.installations[] | select(.app_slug == "${appSlug}") | .id'`,
          { encoding: 'utf-8' },
        );
        return stdout.trim() !== '';
      } catch (_error) {
        return false;
      }
    });
  }

  async getAppInstallationId(org: string, appSlug: string): Promise<string | null> {
    return this.vcr.capture('getAppInstallationId', async () => {
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
    });
  }

  async listInstalledApps(org: string): Promise<Array<{ id: string; slug: string }>> {
    return this.vcr.capture('listInstalledApps', async () => {
      try {
        const { stdout } = await execAsync(
          `gh api /orgs/${org}/installations --jq '.installations[] | {id: .id, slug: .app_slug}'`,
          { encoding: 'utf-8' },
        );
        return stdout
          .trim()
          .split('\n')
          .filter((line) => line)
          .map((line) => JSON.parse(line));
      } catch (_error) {
        return [];
      }
    });
  }
}

export const githubApi = new GitHubApi();
