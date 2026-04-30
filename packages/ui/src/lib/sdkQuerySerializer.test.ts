import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'bun:test';

// Regression: admin readMany pages can send nested filters like
//   query: { searchFields: { targetModel: { in: ['admin'] } } }
// hey-api's default URL serializer can't handle deeply-nested arrays/objects
// — it throws "Deeply-nested arrays/objects aren't supported. Provide your
// own querySerializer()". The fix lives in apps/api buildRequest.ts: admin
// routes always expose the searchFields query schema, which makes openapi-ts
// emit a per-call `querySerializer` that bracket-encodes nested filters.
//
// This test asserts the generated SDK file actually contains that config
// for every admin readMany function. If buildRequest's admin-side gating
// gets reverted, openapi-ts will drop the querySerializer and the client
// will crash again at request time — this guard catches it at test time.

const SDK_PATH = resolve(__dirname, '../apiClient/sdk.gen.ts');

const ADMIN_READ_MANY_FNS = [
  'adminAuditLogReadMany',
  'adminContactReadMany',
  'adminCronJobReadMany',
  'adminInquiryReadMany',
  'adminUserReadMany',
  'adminWebhookSubscriptionReadMany',
];

const QUERY_SERIALIZER_LITERAL =
  "querySerializer: { parameters: { searchFields: { object: { style: 'form' } } } }";

describe('admin readMany SDK querySerializer', () => {
  const sdk = readFileSync(SDK_PATH, 'utf8');

  for (const fnName of ADMIN_READ_MANY_FNS) {
    it(`${fnName} declares the bracket-style searchFields querySerializer`, () => {
      const fnRegex = new RegExp(`export const ${fnName} = [\\s\\S]+?\\.\\.\\.options`, 'm');
      const match = sdk.match(fnRegex);

      expect(match).not.toBeNull();
      expect(match?.[0]).toContain(QUERY_SERIALIZER_LITERAL);
    });
  }
});
