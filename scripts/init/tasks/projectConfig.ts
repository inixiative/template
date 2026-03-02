import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectConfig, getProjectConfigPath } from '../utils/getProjectConfig';

type ProjectConfigData = {
	name: string;
	organization: string;
};

export const getCurrentConfig = async (): Promise<ProjectConfigData> => {
	const config = await getProjectConfig();
	return {
		name: config.project.name,
		organization: config.project.organization,
	};
};

export const updateProjectConfig = (data: ProjectConfigData): void => {
	const configPath = getProjectConfigPath();
	const content = readFileSync(configPath, 'utf-8');

	let updated = content;
	// Update within the project object
	updated = updated.replace(/(project:\s*\{[^}]*name:\s*)['"](.+?)['"]/, `$1'${data.name}'`);
	updated = updated.replace(/(project:\s*\{[^}]*organization:\s*)['"](.+?)['"]/, `$1'${data.organization}'`);

	writeFileSync(configPath, updated, 'utf-8');
};

export const renameProject = (oldName: string, newName: string): void => {
	// If oldName is empty or 'template', use 'template' for replacements
	const fromName = oldName === '' || oldName === 'template' ? 'template' : oldName;
	if (oldName === newName) {
		console.log('No rename needed - project name unchanged');
		return;
	}

	console.log(`\nRenaming project from "${oldName}" to "${newName}"...`);

	// 1. Update root package.json
	console.log('  • Updating root package.json...');
	const rootPkgPath = join(process.cwd(), 'package.json');
	const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
	rootPkg.name = newName;
	writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf-8');

	// 2. Update workspace packages
	console.log('  • Updating workspace packages...');
	const workspaces = ['apps', 'packages'];
	for (const workspace of workspaces) {
		const workspacePath = join(process.cwd(), workspace);
		const dirs = readdirSync(workspacePath, { withFileTypes: true });

		for (const dir of dirs) {
			if (dir.isDirectory()) {
				const pkgPath = join(workspacePath, dir.name, 'package.json');
				try {
					const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
					pkg.name = pkg.name.replace(`@${fromName}/`, `@${newName}/`);
					writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
				} catch (error) {
					// Package.json might not exist, skip
				}
			}
		}
	}

	// 3. Replace import paths in all TypeScript/JavaScript files
	console.log('  • Updating import paths...');
	const extensions = ['ts', 'tsx', 'js', 'jsx'];
	for (const ext of extensions) {
		try {
			execSync(
				`find apps packages -name "*.${ext}" -type f -exec sed -i '' 's/@${fromName}\\///@${newName}\\//g' {} +`,
				{ stdio: 'pipe' }
			);
		} catch (error) {
			// Continue even if some replacements fail
		}
	}

	// 4. Update README.md
	console.log('  • Updating README.md...');
	try {
		const readmePath = join(process.cwd(), 'README.md');
		let readme = readFileSync(readmePath, 'utf-8');
		// Replace title-case references
		readme = readme.replace(new RegExp(`# ${oldName}`, 'gi'), `# ${newName}`);
		readme = readme.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
		writeFileSync(readmePath, readme, 'utf-8');
	} catch (error) {
		// README might not exist
	}

	// 5. Update tsconfig path aliases
	console.log('  • Updating tsconfig path aliases...');
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
			let content = readFileSync(tsconfigPath, 'utf-8');
			content = content.replace(new RegExp(`@${fromName}/`, 'g'), `@${newName}/`);
			writeFileSync(tsconfigPath, content, 'utf-8');
		} catch (error) {
			// Config might not exist
		}
	}

	console.log('  • Running bun install to update lockfile...');
	execSync('bun install', { stdio: 'inherit' });

	console.log(`\n✓ Project renamed successfully to "${newName}"!`);
};
