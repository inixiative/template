import { readFileSync } from 'fs';
import { join } from 'path';

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
