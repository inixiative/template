import { execFileAsync } from '../utils/exec';
import type { ProjectConfig } from '../utils/getProjectConfig';
import { getSecretAsync } from './infisicalSetup';

const BASELINE_MIGRATION = '0_init';

type ExecError = Error & { code?: number; stdout?: string; stderr?: string };

const prisma = (args: string[], databaseUrl?: string) =>
  execFileAsync('bun', ['run', '--cwd', 'packages/db', 'prisma', ...args], {
    encoding: 'utf-8',
    env: databaseUrl ? { ...process.env, DATABASE_URL: databaseUrl } : process.env,
  });

type LaunchConfig = {
  features: Pick<ProjectConfig['features'], 'staging'>;
  infisical: Pick<ProjectConfig['infisical'], 'projectId'>;
};

const deployedEnvironments = (config: LaunchConfig): string[] =>
  config.features.staging.enabled ? ['prod', 'staging'] : ['prod'];

const assertMatchesSchema = async (environment: string, databaseUrl: string) => {
  try {
    await prisma(
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema',
        '--exit-code',
      ],
      databaseUrl,
    );
  } catch (error) {
    if ((error as ExecError).code === 2) {
      throw new Error(
        `The ${environment} database differs from prisma/schema. Deploy the current schema there (the pre-launch release pushes it), then launch.`,
      );
    }
    throw error;
  }
};

const recordBaselineApplied = async (databaseUrl: string) => {
  try {
    await prisma(['migrate', 'resolve', '--applied', BASELINE_MIGRATION], databaseUrl);
  } catch (error) {
    const output = `${(error as ExecError).stdout ?? ''}${(error as ExecError).stderr ?? ''}`;
    if (!output.includes('already recorded as applied')) throw error;
  }
};

export const baselineDeployedDatabases = async (config: LaunchConfig): Promise<void> => {
  await execFileAsync('bun', ['run', '--cwd', 'packages/db', 'db:baseline'], { encoding: 'utf-8' });

  const databases = await Promise.all(
    deployedEnvironments(config).map(async (environment) => ({
      environment,
      databaseUrl: await getSecretAsync('DATABASE_URL', {
        projectId: config.infisical.projectId,
        environment,
        path: '/api',
      }),
    })),
  );

  for (const { environment, databaseUrl } of databases) {
    await assertMatchesSchema(environment, databaseUrl);
  }
  for (const { databaseUrl } of databases) {
    await recordBaselineApplied(databaseUrl);
  }
};
