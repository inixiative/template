import { exec } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { isProgressComplete, setProgressComplete } from '../utils/configHelpers';
import { getProjectConfig, getProjectConfigPath } from '../utils/getProjectConfig';

const execAsync = promisify(exec);

type ProjectConfigData = {
  name: string;
  organization: string;
};

export type StepCallback = (action?: string) => Promise<void>;

export const getCurrentConfig = async (): Promise<ProjectConfigData> => {
  const config = await getProjectConfig();
  return {
    name: config.project.name,
    organization: config.project.organization,
  };
};

export const updateProjectConfig = async (data: ProjectConfigData): Promise<void> => {
  const configPath = getProjectConfigPath();
  const content = await readFile(configPath, 'utf-8');

  let updated = content;
  // Update within the project object
  updated = updated.replace(/(project:\s*\{[^}]*name:\s*)['"](.+?)['"]/, `$1'${data.name}'`);
  updated = updated.replace(/(project:\s*\{[^}]*organization:\s*)['"](.+?)['"]/, `$1'${data.organization}'`);

  await writeFile(configPath, updated, 'utf-8');
};

export const renameProject = async (
  oldName: string,
  newName: string,
  onStepComplete?: StepCallback,
): Promise<void> => {
  const fromName = oldName === '' || oldName === 'template' ? 'template' : oldName;
  if (oldName === newName) {
    return;
  }

  // 1. Update root + workspace package.json files
  if (!(await isProgressComplete('project', 'updatePackages'))) {
    const rootPkgPath = join(process.cwd(), 'package.json');
    const rootContent = await readFile(rootPkgPath, 'utf-8');
    const rootWithScope = rootContent.replace(new RegExp(`@${fromName}/`, 'g'), `@${newName}/`);
    const rootPkg = JSON.parse(rootWithScope);
    rootPkg.name = newName;
    await writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`, 'utf-8');

    const workspaces = ['apps', 'packages'];
    for (const workspace of workspaces) {
      const workspacePath = join(process.cwd(), workspace);
      const dirs = await readdir(workspacePath, { withFileTypes: true });

      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const pkgPath = join(workspacePath, dir.name, 'package.json');
          try {
            const content = await readFile(pkgPath, 'utf-8');
            const updated = content.replace(new RegExp(`@${fromName}/`, 'g'), `@${newName}/`);
            await writeFile(pkgPath, updated, 'utf-8');
          } catch (_error) {
            // Package.json might not exist, skip
          }
        }
      }
    }

    await setProgressComplete('project', 'updatePackages');
    await onStepComplete?.();
  }

  // 2. Replace import paths in all TypeScript/JavaScript files
  if (!(await isProgressComplete('project', 'updateImports'))) {
    try {
      const { stdout } = await execAsync(
        "find apps packages -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \\)",
        { encoding: 'utf-8' },
      );
      const files = stdout.trim().split('\n').filter(Boolean);
      const BATCH = 100;
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        for (const filePath of batch) {
          try {
            const content = await readFile(filePath, 'utf-8');
            const updated = content.replace(new RegExp(`@${fromName}/`, 'g'), `@${newName}/`);
            if (updated !== content) {
              await writeFile(filePath, updated, 'utf-8');
            }
          } catch (_error) {
            // Continue on file failure
          }
        }
        await onStepComplete?.(`${Math.min(i + BATCH, files.length)}/${files.length} files`);
      }
    } catch (_error) {
      // Continue if find fails
    }

    await setProgressComplete('project', 'updateImports');
    await onStepComplete?.();
  }

  // 3. Update README.md
  if (!(await isProgressComplete('project', 'updateReadme'))) {
    try {
      const readmePath = join(process.cwd(), 'README.md');
      let readme = await readFile(readmePath, 'utf-8');
      readme = readme.replace(new RegExp(`# ${oldName}`, 'gi'), `# ${newName}`);
      readme = readme.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
      await writeFile(readmePath, readme, 'utf-8');
    } catch (_error) {
      // README might not exist
    }

    await setProgressComplete('project', 'updateReadme');
    await onStepComplete?.();
  }

  // 4. Update tsconfig path aliases
  if (!(await isProgressComplete('project', 'updateTsconfigs'))) {
    const tsconfigPaths = [
      'tsconfig.json',
      'apps/api/tsconfig.json',
      'apps/web/tsconfig.json',
      'apps/admin/tsconfig.json',
      'apps/superadmin/tsconfig.json',
    ];

    for (const path of tsconfigPaths) {
      try {
        const tsconfigPath = join(process.cwd(), path);
        let content = await readFile(tsconfigPath, 'utf-8');
        content = content.replace(new RegExp(`@${fromName}/`, 'g'), `@${newName}/`);
        await writeFile(tsconfigPath, content, 'utf-8');
      } catch (_error) {
        // Config might not exist
      }
    }

    await setProgressComplete('project', 'updateTsconfigs');
    await onStepComplete?.();
  }

  // 5. Update env example files
  if (!(await isProgressComplete('project', 'updateEnvFiles'))) {
    const envExampleFiles = [
      '.env.local.example',
      '.env.test.example',
      'apps/api/.env.local.example',
      'apps/api/.env.test.example',
      'apps/web/.env.local.example',
      'apps/admin/.env.local.example',
      'apps/superadmin/.env.local.example',
    ];
    for (const envFile of envExampleFiles) {
      try {
        const filePath = join(process.cwd(), envFile);
        const content = await readFile(filePath, 'utf-8');
        const pattern = new RegExp(fromName, 'g');
        const updated = content
          .split('\n')
          .map((line) => {
            if (line.trimStart().startsWith('#')) return line.replace(pattern, newName);
            const eqIdx = line.indexOf('=');
            if (eqIdx === -1) return line;
            const key = line.slice(0, eqIdx);
            const value = line.slice(eqIdx + 1);
            return `${key}=${value.replace(pattern, newName)}`;
          })
          .join('\n');
        await writeFile(filePath, updated, 'utf-8');
      } catch {
        // File might not exist
      }
    }

    await setProgressComplete('project', 'updateEnvFiles');
    await onStepComplete?.();
  }

  // 6. Clean install with new package names
  if (!(await isProgressComplete('project', 'cleanInstall'))) {
    await execAsync('rm -rf node_modules bun.lock');
    await onStepComplete?.('Installing dependencies...');
    await execAsync('bun install');

    await setProgressComplete('project', 'cleanInstall');
    await onStepComplete?.();
  }
};
