#!/usr/bin/env bun
/**
 * Regenerate the Model Capabilities Matrix in `docs/claude/MODEL_CAPABILITIES.md`
 * from the live Prisma field-map and capability registries.
 *
 * Usage:
 *   bun scripts/docs/generateModelCapabilities.ts          # write in place
 *   bun scripts/docs/generateModelCapabilities.ts --check  # exit 1 if out of date
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildModelCapabilitiesRows,
  renderModelCapabilitiesTable,
  replaceCapabilitiesBlock,
} from '../../apps/api/src/hooks/modelCapabilitiesDoc';

const checkOnly = process.argv.includes('--check');
const repoRoot = resolve(import.meta.dir, '../..');
const targetPath = resolve(repoRoot, 'docs/claude/MODEL_CAPABILITIES.md');
const current = readFileSync(targetPath, 'utf8');
const table = renderModelCapabilitiesTable(buildModelCapabilitiesRows());
const next = replaceCapabilitiesBlock(current, table);

if (checkOnly) {
  if (current !== next) {
    console.error(
      'docs/claude/MODEL_CAPABILITIES.md is out of date. Run: bun scripts/docs/generateModelCapabilities.ts',
    );
    process.exit(1);
  }
  console.log('docs/claude/MODEL_CAPABILITIES.md is up to date.');
} else if (current !== next) {
  writeFileSync(targetPath, next, 'utf8');
  console.log('Updated docs/claude/MODEL_CAPABILITIES.md');
} else {
  console.log('docs/claude/MODEL_CAPABILITIES.md unchanged.');
}
