import { describe, expect, it } from 'bun:test';
import { makeRouteMatcher, matchesRoutePattern } from '#/lib/http/routeMatcher';

describe('routeMatcher', () => {
  it('matches exact method and path patterns', () => {
    expect(matchesRoutePattern('GET', '/api/v1/me', 'GET /api/v1/me')).toBe(true);
    expect(matchesRoutePattern('get', '/api/v1/me/', 'GET /api/v1/me')).toBe(true);
    expect(matchesRoutePattern('POST', '/api/v1/me', 'GET /api/v1/me')).toBe(false);
    expect(matchesRoutePattern('GET', '/api/v1/me/twoFactor', 'GET /api/v1/me')).toBe(false);
  });

  it('matches any method when method is omitted or *', () => {
    expect(matchesRoutePattern('GET', '/health', '/health*')).toBe(true);
    expect(matchesRoutePattern('HEAD', '/health/ready', '/health*')).toBe(true);
    expect(matchesRoutePattern('POST', '/api/telemetry/browser', '* /api/telemetry/browser')).toBe(
      true,
    );
    expect(matchesRoutePattern('GET', '/api/other', '/health*')).toBe(false);
  });

  it('supports prefix segment wildcards and parameter segments', () => {
    expect(
      matchesRoutePattern('POST', '/api/v1/me/twoFactor/verify', 'POST /api/v1/me/twoFactor/*'),
    ).toBe(true);
    expect(
      matchesRoutePattern(
        'POST',
        '/api/v1/me/twoFactor/verify/passkey/options',
        'POST /api/v1/me/twoFactor/*',
      ),
    ).toBe(true);
    expect(
      matchesRoutePattern('GET', '/api/v1/user/abc/tokens', 'GET /api/v1/user/{id}/tokens'),
    ).toBe(true);
    expect(
      matchesRoutePattern('GET', '/api/v1/user/abc/other', 'GET /api/v1/user/{id}/tokens'),
    ).toBe(false);
  });

  it('precompiles pattern lists with makeRouteMatcher and strips query strings', () => {
    const matcher = makeRouteMatcher([
      'GET /api/v1/me',
      'POST /api/v1/me/twoFactor/verify',
      'POST /api/v1/me/twoFactor/verify/*',
    ]);

    expect(matcher('GET', '/api/v1/me?foo=bar')).toBe(true);
    expect(matcher('POST', '/api/v1/me/twoFactor/verify')).toBe(true);
    expect(matcher('POST', '/api/v1/me/twoFactor/verify/passkey/options')).toBe(true);
    expect(matcher('POST', '/api/v1/me/twoFactor/verify/../totp/disable')).toBe(false);
    expect(matcher('GET', '//evil.com/api/v1/me')).toBe(false);
    expect(matcher('POST', '/api/v1/me/twoFactor/totp/start')).toBe(false);
  });
});
