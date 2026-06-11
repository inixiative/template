/**
 * @atlas
 * @kind utils
 * @partOf primitive:sdk
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const indexFile = join(import.meta.dir, '../src/index.ts');

if (!existsSync(indexFile)) {
  console.log('No generated index.ts found at', indexFile);
  process.exit(0);
}

const current = readFileSync(indexFile, 'utf8');

const ensureLine = (content: string, line: string): string =>
  content.includes(line) ? content : `${content.trimEnd()}\n${line}\n`;

let next = current;
next = ensureLine(next, "export { client } from './client.gen';");
next = ensureLine(next, "export * from './@tanstack/react-query.gen';");

if (next !== current) {
  writeFileSync(indexFile, next);
  console.log('Patched sdk index exports');
}
