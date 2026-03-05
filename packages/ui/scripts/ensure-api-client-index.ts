import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const indexFile = join(import.meta.dir, '../src/apiClient/index.ts');
const exportLine = "export * from './@tanstack/react-query.gen';";

const current = readFileSync(indexFile, 'utf8');
if (!current.includes(exportLine)) {
  const next = `${current.trimEnd()}\n${exportLine}\n`;
  writeFileSync(indexFile, next);
  console.log('Patched apiClient index exports');
}
