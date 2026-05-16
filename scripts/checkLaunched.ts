/**
 * Exit 0 if the project is launched (project.config.ts → `launched: true`),
 * 1 otherwise. Driven by USE_INTERNAL_CONFIG to pick between the public and
 * template-internal config files.
 *
 * Used by setup.sh and scripts/db/release.sh as a structural alternative to
 * grepping the source file — comments and future config shapes can't fool it.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const file =
  process.env.USE_INTERNAL_CONFIG === 'true'
    ? join(root, 'project.config.template-internal.ts')
    : join(root, 'project.config.ts');

// `project.config.ts` uses a named export (`export const projectConfig = …`),
// not a default export. Reading `mod.default` was always `undefined` → script
// always printed 'false' regardless of `launched`, silently neutering the gate.
const mod = (await import(file)) as { projectConfig?: { launched?: boolean } };
// Print 'true' / 'false' on stdout. Use exit code only for hard errors —
// callers should treat a non-zero exit as "config failed to load" and abort,
// not as "not launched" (which would silently turn db:release into a
// destructive db:push).
process.stdout.write(mod.projectConfig?.launched === true ? 'true' : 'false');
process.exit(0);
