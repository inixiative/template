import { z } from 'zod';
import { loadCicdConfig } from './config';
import { planDelivery } from './plan';

const number = z.number().int().positive();
const eventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('push'), branch: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('pull-request'),
    number,
    draft: z.boolean(),
    sameRepository: z.boolean(),
    closed: z.boolean(),
  }),
  z.strictObject({ kind: z.literal('deploy'), target: z.enum(['production', 'staging']) }),
  z.strictObject({ kind: z.literal('deploy-preview'), number, sameRepository: z.boolean(), closed: z.boolean() }),
  z.strictObject({ kind: z.literal('teardown'), number }),
]);

export const runCicdCommand = async (args: string[]) => {
  const [command, eventPath, ...extra] = args.filter((arg) => arg !== '--');
  if (extra.length || !['validate', 'plan'].includes(command ?? '') || (command === 'validate' && eventPath))
    throw new Error('Usage: bun run cicd validate | bun run cicd plan <event.json>');
  const config = await loadCicdConfig();
  if (command === 'validate') return { valid: true, version: config.version };
  if (!eventPath) throw new Error('A local event.json file is required');
  const event = eventSchema.parse(await Bun.file(eventPath).json());
  return { ...planDelivery(config, event), execution: 'plan-only', authorization: 'not-evaluated' };
};

if (import.meta.main) {
  try {
    console.log(JSON.stringify(await runCicdCommand(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'CI/CD command failed');
    process.exitCode = 1;
  }
}
