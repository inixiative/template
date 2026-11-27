import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IconifyJSON } from '@iconify/react';
import { getIcons } from '@iconify/utils';

const root = join(import.meta.dir, '../../..');
const sourceRoots = [
  'apps/web/app',
  'apps/admin/app',
  'apps/superadmin/app',
  'packages/ui/src',
  'packages/shared/src',
];
const collections = ['lucide', 'simple-icons'] as const;
const output = join(root, 'packages/ui/src/lib/icons/bundledIconCollections.gen.ts');
const iconName = new RegExp(`\\b(${collections.join('|')}):([a-z0-9-]+)`, 'g');

const fetchSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return entry === 'node_modules' ? [] : fetchSourceFiles(path);
    return /\.(tsx?|css)$/.test(entry) ? [path] : [];
  });

const namesByCollection = new Map<string, Set<string>>(
  collections.map((collection) => [collection, new Set()]),
);
for (const file of sourceRoots.flatMap((directory) => fetchSourceFiles(join(root, directory))))
  for (const [, collection, name] of readFileSync(file, 'utf8').matchAll(iconName))
    if (collection && name) namesByCollection.get(collection)?.add(name);

const subset = collections.flatMap((collection) => {
  const data: IconifyJSON = JSON.parse(
    readFileSync(join(root, `node_modules/@iconify-json/${collection}/icons.json`), 'utf8'),
  );
  const names = [...(namesByCollection.get(collection) ?? [])].sort();
  const icons = getIcons(data, names);
  const missing = names.filter((name) => !icons?.icons[name] && !icons?.aliases?.[name]);
  if (missing.length) throw new Error(`Unknown ${collection} icons: ${missing.join(', ')}`);
  return icons ? [icons] : [];
});

writeFileSync(
  output,
  `import type { IconifyJSON } from '@iconify/react';\n\nexport const bundledIconCollections: IconifyJSON[] = ${JSON.stringify(subset)};\n`,
);
