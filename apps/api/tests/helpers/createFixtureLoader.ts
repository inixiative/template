import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dir, '..', 'fixtures');

type AIProvider = 'anthropic' | 'openai' | 'google';

/**
 * Create a fixture loader for a specific directory
 *
 * @param basePath - Absolute path to fixtures directory (use __dirname + '/fixtures')
 * @returns Loader function that loads JSON files by name
 *
 * @example
 * const load = createFixtureLoader(__dirname + '/fixtures');
 * const response = load<AnthropicResponse>('chatCompletion');
 */
export const createFixtureLoader = (basePath: string) => {
  return <T = unknown>(filename: string): T => {
    const fullPath = join(basePath, `${filename}.json`);
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as T;
  };
};

/**
 * Load a fixture by path relative to apps/api/tests/fixtures/
 *
 * @example
 * const msg = loadFixture<AnthropicMessage>('anthropic/chatCompletion');
 * const embed = loadFixture<OpenAIEmbedding>('openai/embedding');
 */
export const loadFixture = <T = unknown>(name: string): T => {
  const fullPath = join(FIXTURES_DIR, `${name}.json`);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
};

/**
 * Provider-aware fixture loader.
 *
 * Resolves fixtures by provider + operation, e.g.:
 *   loadProviderFixture('anthropic', 'chatCompletion')
 *   → fixtures/anthropic/chatCompletion.json
 *
 * Supports provider fallback: if a provider-specific fixture doesn't exist,
 * falls back to a generic one (useful for shared response shapes).
 *
 * @example
 * const loader = createProviderFixtureLoader('anthropic');
 * const msg = loader<AnthropicMessage>('chatCompletion');
 * const errors = loader<ErrorResponse>('errors/rateLimited');
 */
export const createProviderFixtureLoader = (provider: AIProvider) => {
  return <T = unknown>(operation: string): T => {
    const providerPath = join(FIXTURES_DIR, provider, `${operation}.json`);

    // Try provider-specific first
    if (existsSync(providerPath)) {
      const content = readFileSync(providerPath, 'utf-8');
      return JSON.parse(content) as T;
    }

    // Fall back to shared fixture
    const sharedPath = join(FIXTURES_DIR, 'shared', `${operation}.json`);
    if (existsSync(sharedPath)) {
      const content = readFileSync(sharedPath, 'utf-8');
      return JSON.parse(content) as T;
    }

    throw new Error(
      `Fixture not found: ${provider}/${operation}.json (also checked shared/${operation}.json)`,
    );
  };
};

/**
 * Load all fixtures in a directory in sorted order.
 * For sequences like: anthropic/happy/01-init.json, 02-chat.json, etc.
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
