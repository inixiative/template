/**
 * Sanitize sensitive data from API responses before saving as VCR fixtures.
 *
 * Usage (recording mode — run manually, not in CI):
 *   const raw = await createRole(org, db, branch, name);
 *   const safe = sanitize(raw);
 *   writeFileSync('fixtures/planetscale/createRole-prod.json', JSON.stringify(safe, null, 2));
 */

type SanitizeRule = {
  /** Regex pattern to match sensitive values */
  pattern: RegExp;
  /** Replacement string (use $1, $2 for capture groups) */
  replacement: string;
};

const DEFAULT_RULES: SanitizeRule[] = [
  // PlanetScale service tokens
  { pattern: /pscale_tkid_[a-zA-Z0-9_-]+/g, replacement: 'pscale_tkid_SANITIZED_abc123' },
  { pattern: /pscale_tk_[a-zA-Z0-9_-]+/g, replacement: 'pscale_tk_SANITIZED_xyz789' },

  // Connection strings (postgresql://)
  {
    pattern: /postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/([^\s"?]+)/g,
    replacement: 'postgresql://sanitized_user:SANITIZED_PASSWORD@$3/$4',
  },

  // MySQL connection strings
  {
    pattern: /mysql:\/\/([^:]+):([^@]+)@([^/]+)\/([^\s"?]+)/g,
    replacement: 'mysql://sanitized_user:SANITIZED_PASSWORD@$3/$4',
  },

  // Generic passwords / plain_text values (UUID-like or base64-like)
  { pattern: /(?<="plain_text":\s*")[^"]+/g, replacement: 'SANITIZED_PASSWORD_xyz789' },
  { pattern: /(?<="password":\s*")[^"]+/g, replacement: 'SANITIZED_PASSWORD_xyz789' },

  // Usernames in API responses
  { pattern: /(?<="username":\s*")[^"]+/g, replacement: 'sanitized_user_abc123' },

  // Infisical tokens (JWT-like)
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: 'SANITIZED_JWT_TOKEN' },

  // Railway tokens
  { pattern: /railway_[a-zA-Z0-9_-]{20,}/g, replacement: 'railway_SANITIZED_token_abc123' },

  // Vercel tokens
  { pattern: /vercel_[a-zA-Z0-9_-]{20,}/g, replacement: 'vercel_SANITIZED_token_abc123' },

  // Generic Bearer tokens
  { pattern: /(?<=Bearer\s)[a-zA-Z0-9_.-]{20,}/g, replacement: 'SANITIZED_BEARER_TOKEN' },

  // UUIDs (replace with deterministic zeroed UUIDs, preserving structure)
  // Only in id/token fields, not everywhere
  {
    pattern:
      /(?<="(?:id|token_id|project_id|organization_id|workspace_id|environment_id|service_id)":\s*")[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
    replacement: '00000000-0000-0000-0000-000000000000',
  },

  // Email addresses
  { pattern: /(?<="email":\s*")[^"]+@[^"]+/g, replacement: 'sanitized@example.com' },
];

/**
 * Sanitize a value (object, array, or string) by applying all rules.
 * Works on the JSON string representation to catch nested values.
 */
export const sanitize = <T>(data: T, extraRules: SanitizeRule[] = []): T => {
  const rules = [...DEFAULT_RULES, ...extraRules];
  let json = JSON.stringify(data, null, 2);

  for (const rule of rules) {
    json = json.replace(rule.pattern, rule.replacement);
  }

  return JSON.parse(json) as T;
};

/**
 * Sanitize and write a fixture file.
 * Only use during manual recording sessions, never in CI.
 */
export const recordFixture = (name: string, data: unknown, extraRules: SanitizeRule[] = []): void => {
  const { writeFileSync, mkdirSync } = require('node:fs');
  const { join, dirname } = require('node:path');

  const fixturesDir = join(import.meta.dir, '..', 'fixtures');
  const fullPath = join(fixturesDir, `${name}.json`);

  mkdirSync(dirname(fullPath), { recursive: true });

  const sanitized = sanitize(data, extraRules);
  writeFileSync(fullPath, `${JSON.stringify(sanitized, null, 2)}\n`);
};

export type { SanitizeRule };
