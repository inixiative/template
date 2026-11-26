import { describe, expect, it } from 'bun:test';
import { withEnv } from '@template/shared/utils';
import { allowedCorsOrigins, matchingCorsOrigin } from '#/middleware/corsMiddleware';

describe('corsMiddleware', () => {
  it('denies arbitrary vercel.app and render.com origins in pr, staging, and prod', async () => {
    for (const env of ['pr', 'staging', 'prod'] as const) {
      await withEnv(
        {
          ENVIRONMENT: env,
          WEB_URL: 'https://app.example.com/',
          ADMIN_URL: undefined,
          SUPERADMIN_URL: undefined,
          CORS_ALLOWED_ORIGIN_PATTERNS: undefined,
        },
        () => {
          expect(matchingCorsOrigin('https://app.example.com')).toBe('https://app.example.com');
          expect(matchingCorsOrigin('https://evil.vercel.app')).toBeNull();
          expect(matchingCorsOrigin('https://evil.render.com')).toBeNull();
        },
      );
    }
  });

  it('supports https-only wildcard patterns and drops unsafe entries from allowedCorsOrigins', async () => {
    await withEnv(
      {
        ENVIRONMENT: 'pr',
        WEB_URL: undefined,
        ADMIN_URL: undefined,
        SUPERADMIN_URL: undefined,
        CORS_ALLOWED_ORIGIN_PATTERNS:
          'https://myapp-*-team.vercel.app, https://*.example.com, *, https://*.com, https://*example.com, https://myapp-*-team.com, https://*.example..com, http://*.example.com, *.example.com',
      },
      () => {
        expect(allowedCorsOrigins()).toEqual([
          'https://myapp-*-team.vercel.app',
          'https://*.example.com',
        ]);
        expect(matchingCorsOrigin('https://myapp-pr123-team.vercel.app')).toBe(
          'https://myapp-pr123-team.vercel.app',
        );
        expect(matchingCorsOrigin('https://sub.example.com')).toBe('https://sub.example.com');
        expect(matchingCorsOrigin('https://a.b.example.com')).toBe('https://a.b.example.com');
        expect(matchingCorsOrigin('https://evilexample.com')).toBeNull();
        expect(matchingCorsOrigin('https://myapp-evil-team.com')).toBeNull();
        expect(matchingCorsOrigin('http://sub.example.com')).toBeNull();
        expect(matchingCorsOrigin('https://sub.example.com:8443')).toBeNull();
        expect(matchingCorsOrigin('https://evil.vercel.app')).toBeNull();
        expect(matchingCorsOrigin('https://myapp-a.b-team.vercel.app')).toBeNull();
        expect(matchingCorsOrigin('https://anything.com')).toBeNull();
      },
    );
  });
});
