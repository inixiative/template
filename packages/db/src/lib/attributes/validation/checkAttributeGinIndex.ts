/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ModelName } from '@template/db/utils/modelNames';

const stripSchemaComments = (schemaBody: string): string =>
  schemaBody.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const readModelSchemaBody = (modelName: string, schemaDir: string): string | null => {
  const files = readdirSync(schemaDir).filter((file) => file.endsWith('.prisma'));
  const pattern = new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`);
  for (const file of files) {
    const content = readFileSync(resolve(schemaDir, file), 'utf8');
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

const hasGinIndexOnValueJson = (schemaBody: string): boolean =>
  /@@index\(\s*\[\s*valueJson(?:\s*\([^)]*\))?\s*\]\s*,\s*[^)]*type\s*:\s*Gin\b/.test(
    stripSchemaComments(schemaBody),
  );

/** Verifies `valueJson` carries a Postgres GIN index (supporting optional opclass syntax and ignoring comments). */
export const checkAttributeGinIndex = (
  modelName: ModelName,
  indexLists: readonly (readonly string[])[],
  schemaDir: string,
  schemaBodyOverride?: string,
): string[] => {
  const hasJsonIndex = indexLists.some(
    (fields) => fields.length === 1 && fields[0] === 'valueJson',
  );
  const schemaBody = schemaBodyOverride ?? readModelSchemaBody(modelName, schemaDir);

  if (!hasJsonIndex || !schemaBody || !hasGinIndexOnValueJson(schemaBody)) {
    return [
      `${modelName}.valueJson: missing Postgres GIN index (add @@index([valueJson], type: Gin))`,
    ];
  }
  return [];
};
