import { expect, test } from 'bun:test';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { saveCicdConfig } from './config';
import { makeCicdConfig } from './fixtures';

const source = resolve(import.meta.dir, '../..');

test('init and shell environment selection agree when delivery policy overrides legacy staging', async () => {
  const root = await mkdtemp(join(tmpdir(), 'template-cicd-integration-'));
  try {
    for (const file of [
      'init/utils/getProjectConfig.ts',
      'scripts/cicd/config.ts',
      'scripts/deployment/read-project-config.sh',
      'scripts/deployment/locate-config.sh',
    ]) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await copyFile(join(source, file), join(root, file));
    }
    await symlink(join(source, 'node_modules'), join(root, 'node_modules'));
    await writeFile(
      join(root, 'project.config.ts'),
      'export const projectConfig = {project: {progress: {}}, features: {staging: {enabled: false}}};',
    );
    const config = makeCicdConfig();
    config.staging.enabled = true;
    await saveCicdConfig(config, root);
    const run = () =>
      Bun.spawnSync(['bash', join(root, 'scripts/deployment/read-project-config.sh'), 'features.staging.enabled'], {
        cwd: root,
        env: { PATH: process.env.PATH, USE_INTERNAL_CONFIG: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      });
    const enabled = run();
    expect(enabled.exitCode).toBe(0);
    expect(enabled.stdout.toString()).toBe('true');
    await writeFile(join(root, 'cicd.config.ts'), 'export const cicdConfig = { broken: true };');
    expect(run().exitCode).not.toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
