import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execAsync } from '../utils/exec';
import { getProjectConfig, writeProjectConfig } from '../utils/getProjectConfig';
import { isComplete, markComplete } from '../utils/progressTracking';

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
  const config = await getProjectConfig();
  config.project.name = data.name;
  config.project.organization = data.organization;
  await writeProjectConfig(config);
};

export const renameProject = async (oldName: string, newName: string, onStepComplete?: StepCallback): Promise<void> => {
  const fromName = oldName === '' || oldName === 'template' ? 'template' : oldName;
  if (oldName === newName) {
    return;
  }

  // 1. Update root + workspace package.json files
  if (!(await isComplete('project', 'updatePackages'))) {
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

    await markComplete('project', 'updatePackages');
    await onStepComplete?.();
  }

  // 2. Replace @scope/ references in all source files
  if (!(await isComplete('project', 'updateImports'))) {
    try {
      const { stdout } = await execAsync(
        "find apps packages scripts docs init -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.sh' -o -name '*.md' \\)",
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

    await markComplete('project', 'updateImports');
    await onStepComplete?.();
  }

  // 3. Update README.md
  if (!(await isComplete('project', 'updateReadme'))) {
    try {
      const readmePath = join(process.cwd(), 'README.md');
      let readme = await readFile(readmePath, 'utf-8');
      readme = readme.replace(new RegExp(`# ${oldName}`, 'gi'), `# ${newName}`);
      readme = readme.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
      await writeFile(readmePath, readme, 'utf-8');
    } catch (_error) {
      // README might not exist
    }

    await markComplete('project', 'updateReadme');
    await onStepComplete?.();
  }

  // 4. Update tsconfig path aliases
  if (!(await isComplete('project', 'updateTsconfigs'))) {
    const tsconfigPaths = [
      'tsconfig.json',
      'tsconfig.frontend.json',
      'apps/api/tsconfig.json',
      'apps/web/tsconfig.json',
      'apps/admin/tsconfig.json',
      'apps/superadmin/tsconfig.json',
      'packages/db/tsconfig.json',
      'packages/email/tsconfig.json',
      'packages/permissions/tsconfig.json',
      'packages/shared/tsconfig.json',
      'packages/ui/tsconfig.json',
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

    await markComplete('project', 'updateTsconfigs');
    await onStepComplete?.();
  }

  // 5. Update env example files
  if (!(await isComplete('project', 'updateEnvFiles'))) {
    const envFiles = [
      '.env.local',
      '.env.test',
      '.env.local.example',
      '.env.test.example',
      'apps/api/.env.local',
      'apps/api/.env.test',
      'apps/api/.env.local.example',
      'apps/api/.env.test.example',
      'apps/web/.env.local',
      'apps/web/.env.test',
      'apps/web/.env.local.example',
      'apps/admin/.env.local',
      'apps/admin/.env.test',
      'apps/admin/.env.local.example',
      'apps/superadmin/.env.local',
      'apps/superadmin/.env.test',
      'apps/superadmin/.env.local.example',
      'packages/db/.env.test',
    ];
    for (const envFile of envFiles) {
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

    await markComplete('project', 'updateEnvFiles');
    await onStepComplete?.();
  }

  // 6. Clean install with new package names
  if (!(await isComplete('project', 'cleanInstall'))) {
    await execAsync('rm -rf node_modules bun.lock');
    await onStepComplete?.('Installing dependencies...');
    await execAsync('bun install');

    await markComplete('project', 'cleanInstall');
    await onStepComplete?.();
  }
};
