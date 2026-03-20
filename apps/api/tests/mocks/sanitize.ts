/**
 * Sanitize sensitive data from API responses before saving as VCR fixtures.
 *
 * Usage (recording mode — run manually, not in CI):
 *   const raw = await anthropic.messages.create({ ... });
 *   const safe = sanitize(raw);
 *   writeFileSync('fixtures/anthropic/chatCompletion.json', JSON.stringify(safe, null, 2));
 */

export type SanitizeRule = {
  /** Regex pattern to match sensitive values */
  pattern: RegExp;
  /** Replacement string (use $1, $2 for capture groups) */
  replacement: string;
};

const DEFAULT_RULES: SanitizeRule[] = [
  // --- AI Provider API keys ---
  // Anthropic
  { pattern: /sk-ant-[a-zA-Z0-9_-]+/g, replacement: 'sk-ant-SANITIZED_key_abc123' },
  // OpenAI
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-SANITIZED_key_abc123xyz789' },
  // Google AI
  { pattern: /AIzaSy[a-zA-Z0-9_-]{33}/g, replacement: 'AIzaSy_SANITIZED_key_abc123' },

  // --- AI response IDs (may encode billing/org info) ---
  { pattern: /(?<="id":\s*")msg_[a-zA-Z0-9_-]+/g, replacement: 'msg_SANITIZED_000' },
  { pattern: /(?<="id":\s*")chatcmpl-[a-zA-Z0-9_-]+/g, replacement: 'chatcmpl-SANITIZED_000' },
  { pattern: /(?<="id":\s*")run-[a-zA-Z0-9_-]+/g, replacement: 'run-SANITIZED_000' },

  // --- Organization / account IDs in headers or responses ---
  { pattern: /(?<="organization":\s*")org-[a-zA-Z0-9]+/g, replacement: 'org-SANITIZED' },
  { pattern: /(?<="x-organization-id":\s*")[^"]+/g, replacement: 'SANITIZED_ORG_ID' },

  // --- System fingerprints (OpenAI) ---
  { pattern: /(?<="system_fingerprint":\s*")fp_[a-zA-Z0-9]+/g, replacement: 'fp_SANITIZED' },

  // --- Connection strings ---
  {
    pattern: /postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/([^\s"?]+)/g,
    replacement: 'postgresql://sanitized_user:SANITIZED_PASSWORD@$3/$4',
  },
  {
    pattern: /mysql:\/\/([^:]+):([^@]+)@([^/]+)\/([^\s"?]+)/g,
    replacement: 'mysql://sanitized_user:SANITIZED_PASSWORD@$3/$4',
  },
  {
    pattern: /redis:\/\/([^:]*):?([^@]*)@([^/]+)/g,
    replacement: 'redis://sanitized_user:SANITIZED_PASSWORD@$3',
  },

  // --- Generic secrets ---
  { pattern: /(?<="plain_text":\s*")[^"]+/g, replacement: 'SANITIZED_PASSWORD_xyz789' },
  { pattern: /(?<="password":\s*")[^"]+/g, replacement: 'SANITIZED_PASSWORD_xyz789' },
  { pattern: /(?<="username":\s*")[^"]+/g, replacement: 'sanitized_user_abc123' },

  // --- JWT tokens ---
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: 'SANITIZED_JWT_TOKEN' },

  // --- Bearer tokens ---
  { pattern: /(?<=Bearer\s)[a-zA-Z0-9_.-]{20,}/g, replacement: 'SANITIZED_BEARER_TOKEN' },

  // --- Service tokens ---
  { pattern: /pscale_tkid_[a-zA-Z0-9_-]+/g, replacement: 'pscale_tkid_SANITIZED_abc123' },
  { pattern: /pscale_tk_[a-zA-Z0-9_-]+/g, replacement: 'pscale_tk_SANITIZED_xyz789' },
  { pattern: /railway_[a-zA-Z0-9_-]{20,}/g, replacement: 'railway_SANITIZED_token_abc123' },
  { pattern: /vercel_[a-zA-Z0-9_-]{20,}/g, replacement: 'vercel_SANITIZED_token_abc123' },

  // --- Email addresses ---
  { pattern: /(?<="email":\s*")[^"]+@[^"]+/g, replacement: 'sanitized@example.com' },

  // --- UUIDs in ID fields ---
  {
    pattern: /(?<="(?:id|token_id|project_id|organization_id|workspace_id|environment_id|service_id)":\s*")[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
    replacement: '00000000-0000-0000-0000-000000000000',
  },
];

/**
 * Sanitize a value by applying all rules to its JSON representation.
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
  writeFileSync(fullPath, JSON.stringify(sanitized, null, 2) + '\n');
};
