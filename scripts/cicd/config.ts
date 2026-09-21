import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const branchSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
  .refine(
    (value) =>
      !value.includes('..') &&
      value.split('/').every((part) => part && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith('.lock')),
  );
const deployMode = z.enum(['auto', 'manual']);

export const cicdSchema = z
  .strictObject({
    version: z.literal(1),
    production: z.strictObject({ branch: branchSchema, deploy: z.literal('auto') }),
    staging: z.strictObject({ enabled: z.boolean(), branch: branchSchema }),
    pullRequests: z.strictObject({
      deploy: deployMode,
      drafts: z.strictObject({ deploy: deployMode }),
      requiredApprovals: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      allowBotApprovals: z.boolean(),
      cleanupOnClose: z.literal(true),
      maxActive: z.number().int().min(1).max(20),
    }),
    checks: z.strictObject({ pre: z.literal(true), post: z.literal(true) }),
    database: z.strictObject({ strategy: z.enum(['schema-push', 'migrations']) }),
  })
  .refine((value) => value.production.branch !== value.staging.branch, {
    message: 'Production and staging must track different branches',
    path: ['staging', 'branch'],
  });

export type CicdConfig = z.infer<typeof cicdSchema>;

export const loadCicdConfig = async (root = process.cwd()): Promise<CicdConfig> => {
  const module = await import(`${join(root, 'cicd.config.ts')}?revision=${randomUUID()}`);
  return cicdSchema.parse(module.cicdConfig);
};

export const saveCicdConfig = async (value: CicdConfig, root = process.cwd()): Promise<void> => {
  const config = cicdSchema.parse(value);
  const path = join(root, 'cicd.config.ts');
  const temporary = `${path}.${randomUUID()}.tmp`;
  const source = `import type { CicdConfig } from './scripts/cicd/config';\n\nexport const cicdConfig = ${JSON.stringify(config, null, 2)} satisfies CicdConfig;\n`;
  const formatter = Bun.spawn(['bun', 'x', '--no-install', 'biome', 'format', '--stdin-file-path=cicd.config.ts'], {
    cwd: resolve(import.meta.dir, '../..'),
    stdin: new Blob([source]),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const formatted = await new Response(formatter.stdout).text();
  if ((await formatter.exited) !== 0) throw new Error('Unable to format delivery settings; existing file preserved');
  try {
    await writeFile(temporary, formatted, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
};
