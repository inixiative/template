import { join } from 'node:path';
import { createVcrRecorder, fetchCliVersion } from '@inixiative/vcr';
import { execAsync } from '../utils/exec';
import { captureInTest } from './capture';

const FIXTURES_DIR = join(import.meta.dir, '../tests/fixtures/github');

class GitHubApi {
  readonly vcr = createVcrRecorder(FIXTURES_DIR, {
    service: 'github',
    version: () => fetchCliVersion('gh'),
  });

  async isAppInstalled(org: string, appSlug: string): Promise<boolean> {
    return captureInTest(this.vcr, 'isAppInstalled', async () => {
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

  async fetchAppInstallationId(org: string, appSlug: string): Promise<string | null> {
    return captureInTest(this.vcr, 'fetchAppInstallationId', async () => {
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
    return captureInTest(this.vcr, 'listInstalledApps', async () => {
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
