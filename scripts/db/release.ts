import { join, resolve } from 'node:path';
import { Glob } from 'bun';
import type { CicdConfig } from '../cicd/config';
import { loadCicdConfig } from '../cicd/config';

export const findCommittedMigrations = (root: string) => [
  ...new Glob('**/migration.sql').scanSync(join(root, 'packages/db/prisma')),
];

export const databaseReleaseCommands = (
  strategy: CicdConfig['database']['strategy'],
  migrations: string[],
  seedOnRelease: boolean,
) => {
  if (strategy === 'migrations' && migrations.length === 0)
    throw new Error('Migration mode requires committed migration SQL. Create or verify a baseline before release.');
  if (strategy === 'schema-push' && migrations.length > 0)
    throw new Error(
      'Migration SQL exists but database.strategy is schema-push. Select migrations before release: bun run init:agent --section=cicd --database=migrations',
    );
  return [
    [
      'bun',
      'run',
      '--cwd',
      'packages/db',
      'prisma',
      ...(strategy === 'migrations' ? ['migrate', 'deploy'] : ['db', 'push']),
    ],
    ...(seedOnRelease ? [['bun', 'run', '--cwd', 'apps/api', 'db:seed']] : []),
  ];
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, '../..');
  const config = await loadCicdConfig(root);
  const commands = databaseReleaseCommands(
    config.database.strategy,
    findCommittedMigrations(root),
    config.database.seedOnRelease,
  );
  for (const command of commands) {
    const child = Bun.spawn(command, { cwd: root, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
    const code = await child.exited;
    if (code !== 0) process.exit(code);
  }
}
