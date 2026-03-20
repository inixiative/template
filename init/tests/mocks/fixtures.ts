import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dir, '..', 'fixtures');

/**
 * Load a JSON fixture file by path relative to init/tests/fixtures/
 *
 * @example
 * const db = loadFixture<PlanetScaleDatabase>('planetscale/createDatabase');
 * const orgs = loadFixture<PlanetScaleOrganization[]>('planetscale/listOrganizations');
 */
export const loadFixture = <T = unknown>(name: string): T => {
  const fullPath = join(FIXTURES_DIR, `${name}.json`);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
};

/**
 * Load all fixtures in a sequence (e.g., for a full setup pass).
 * Files should be named like: planetscale/happy/01-listOrgs.json, 02-createDb.json, etc.
 */
export const loadFixtureSequence = <T = unknown>(dir: string): T[] => {
  const { readdirSync } = require('node:fs');
  const fullDir = join(FIXTURES_DIR, dir);
  const files = (readdirSync(fullDir) as string[])
    .filter((f: string) => f.endsWith('.json'))
    .sort();

  return files.map((file: string) => {
    const content = readFileSync(join(fullDir, file), 'utf-8');
    return JSON.parse(content) as T;
  });
};
