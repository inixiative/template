import { describe, expect, it } from 'bun:test';
import { interpolateRequest, interpolateValue } from '#/modules/batch/services/interpolation';

describe('interpolation', () => {
  describe('interpolateValue', () => {
    it('interpolates simple field reference', () => {
      const context = {
        results: [[{ id: 'user-123', name: 'John' }]],
      };

      const result = interpolateValue('User ID: <<0.0.id>>', context);
      expect(result).toBe('User ID: user-123');
    });

    it('interpolates nested field reference', () => {
      const context = {
        results: [[{ data: { user: { email: 'test@example.com' } } }]],
      };

      const result = interpolateValue('Email: <<0.0.data.user.email>>', context);
      expect(result).toBe('Email: test@example.com');
    });

    it('interpolates multiple references in one string', () => {
      const context = {
        results: [
          [
            { id: 'user-123', name: 'John' },
            { id: 'org-456', name: 'Acme' },
          ],
        ],
      };

      const result = interpolateValue('<<0.0.name>> works at <<0.1.name>>', context);
      expect(result).toBe('John works at Acme');
    });

    it('interpolates across multiple rounds', () => {
      const context = {
        results: [[{ id: 'user-123' }], [{ userId: 'user-123', orgId: 'org-456' }]],
      };

      const result = interpolateValue('User: <<0.0.id>>, Org: <<1.0.orgId>>', context);
      expect(result).toBe('User: user-123, Org: org-456');
    });

    it('interpolates values in objects', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      const result = interpolateValue(
        {
          userId: '<<0.0.id>>',
          name: 'Test',
        },
        context,
      );

      expect(result).toEqual({
        userId: 'user-123',
        name: 'Test',
      });
    });

    it('interpolates values in arrays', () => {
      const context = {
        results: [[{ id: 'user-123' }, { id: 'user-456' }]],
      };

      const result = interpolateValue(['<<0.0.id>>', '<<0.1.id>>'], context);
      expect(result).toEqual(['user-123', 'user-456']);
    });

    it('interpolates nested objects and arrays', () => {
      const context = {
        results: [[{ id: 'user-123', name: 'John' }]],
      };

      const result = interpolateValue(
        {
          users: [{ id: '<<0.0.id>>', name: '<<0.0.name>>' }],
        },
        context,
      );

      expect(result).toEqual({
        users: [{ id: 'user-123', name: 'John' }],
      });
    });

    it('returns non-string values unchanged', () => {
      const context = { results: [[]] };

      expect(interpolateValue(123, context)).toBe(123);
      expect(interpolateValue(true, context)).toBe(true);
      expect(interpolateValue(null, context)).toBe(null);
    });

    it('throws error for round index out of bounds', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<1.0.id>>', context)).toThrow('Round index out of bounds');
      expect(() => interpolateValue('<<5.0.id>>', context)).toThrow(
        'round 5 does not exist (only 1 rounds completed)',
      );
    });

    it('throws error for request index out of bounds', () => {
      const context = {
        results: [[{ id: 'user-123' }, { id: 'user-456' }]],
      };

      expect(() => interpolateValue('<<0.5.id>>', context)).toThrow('Request index out of bounds');
      expect(() => interpolateValue('<<0.10.id>>', context)).toThrow(
        'request 10 does not exist in round 0 (only 2 requests completed)',
      );
    });

    it('throws error for missing field', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<0.0.email>>', context)).toThrow(
        'Field not found in interpolation',
      );
    });

    it('throws error for invalid path notation', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<0.0.a.b.c.d.e.f.g>>', context)).toThrow(
        'Invalid interpolation path',
      );
    });

    it('throws error for malformed interpolation syntax - missing field', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<1.2>>', context)).toThrow('Malformed interpolation syntax');
    });

    it('throws error for malformed interpolation syntax - non-numeric indices', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<abc.def.field>>', context)).toThrow(
        'Malformed interpolation syntax',
      );
    });

    it('throws error for malformed interpolation syntax - single number', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<123>>', context)).toThrow('Malformed interpolation syntax');
    });

    it('throws error for malformed interpolation syntax - empty', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<>>', context)).toThrow('Malformed interpolation syntax');
    });

    it('throws error when referencing current round', () => {
      const context = {
        results: [[{ id: 'user-123' }], [{ id: 'user-456' }]],
        currentRound: 1,
      };

      expect(() => interpolateValue('<<1.0.id>>', context)).toThrow('Invalid round reference');
      expect(() => interpolateValue('<<1.0.id>>', context)).toThrow(
        'cannot reference round 1 from round 1',
      );
    });

    it('throws error when referencing future round', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
        currentRound: 1,
      };

      expect(() => interpolateValue('<<2.0.id>>', context)).toThrow('Invalid round reference');
      expect(() => interpolateValue('<<5.0.id>>', context)).toThrow(
        'cannot reference round 5 from round 1',
      );
    });

    it('allows referencing previous rounds', () => {
      const context = {
        results: [[{ id: 'user-123' }], [{ id: 'user-456' }]],
        currentRound: 2,
      };

      const result1 = interpolateValue('<<0.0.id>>', context);
      expect(result1).toBe('user-123');

      const result2 = interpolateValue('<<1.0.id>>', context);
      expect(result2).toBe('user-456');
    });

    it('allows any round when currentRound is not specified (backward compat)', () => {
      const context = {
        results: [[{ id: 'user-123' }], [{ id: 'user-456' }]],
      };

      const result = interpolateValue('<<1.0.id>>', context);
      expect(result).toBe('user-456');
    });
  });

  describe('interpolateRequest', () => {
    it('interpolates path', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      const request = {
        method: 'GET',
        path: '/api/v1/users/<<0.0.id>>',
      };

      const result = interpolateRequest(request, context);
      expect(result.path).toBe('/api/v1/users/user-123');
    });

    it('interpolates body', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      const request = {
        method: 'POST',
        path: '/api/v1/organizations',
        body: {
          name: 'Test Org',
          ownerId: '<<0.0.id>>',
        },
      };

      const result = interpolateRequest(request, context);
      expect(result.body).toEqual({
        name: 'Test Org',
        ownerId: 'user-123',
      });
    });

    it('preserves raw JSON types when a body value is a single interpolation token', () => {
      const context = {
        results: [
          [{ count: 42, active: true, empty: null, tags: ['a', 'b'], meta: { nested: 1 } }],
        ],
      };

      const request = {
        method: 'POST',
        path: '/api/v1/items',
        body: {
          count: '<<0.0.count>>',
          active: '<<0.0.active>>',
          empty: '<<0.0.empty>>',
          tags: '<<0.0.tags>>',
          meta: '<<0.0.meta>>',
          mixed: 'count=<<0.0.count>>',
        },
      };

      const result = interpolateRequest(request, context);
      expect(result.body).toEqual({
        count: 42,
        active: true,
        empty: null,
        tags: ['a', 'b'],
        meta: { nested: 1 },
        mixed: 'count=42',
      });
    });

    it('interpolates headers', () => {
      const context = {
        results: [[{ token: 'secret-token' }]],
      };

      const request = {
        method: 'GET',
        path: '/api/v1/me',
        headers: {
          Authorization: 'Bearer <<0.0.token>>',
        },
      };

      const result = interpolateRequest(request, context);
      expect(result.headers).toEqual({
        Authorization: 'Bearer secret-token',
      });
    });

    it('preserves request fields without interpolation', () => {
      const context = { results: [[]] };

      const request = {
        method: 'GET',
        path: '/api/v1/me',
      };

      const result = interpolateRequest(request, context);
      expect(result).toEqual({
        method: 'GET',
        path: '/api/v1/me',
        body: undefined,
        headers: undefined,
      });
    });
  });

  describe('escapes and encoded paths', () => {
    const context = { results: [[{ id: 'org-1' }]], currentRound: 1 };

    it('keeps an escaped bracket literal beside a live reference', () => {
      expect(interpolateValue('id <<0.0.id>> and \\<<literal\\>>', context)).toBe(
        'id org-1 and <<literal>>',
      );
    });

    it('lets an escaped backslash precede a live reference', () => {
      expect(interpolateValue('x \\\\<<0.0.id>>', context)).toBe('x \\org-1');
    });

    it('still refuses an unescaped stray bracket', () => {
      expect(() => interpolateValue('a << b', context)).toThrow('unclosed <<');
    });

    it('reads escapes in headers too', () => {
      const request = interpolateRequest(
        { method: 'GET', path: '/api/v1/me', headers: { 'x-note': '\\<<kept\\>> <<0.0.id>>' } },
        context,
      );
      expect(request.headers?.['x-note']).toBe('<<kept>> org-1');
    });

    it('keeps an encoded escaped reference in a path literal', () => {
      const request = interpolateRequest(
        { method: 'GET', path: '/api/v1/search?q=%5C%3C%3C0.0.id%5C%3E%3E' },
        context,
      );
      expect(request.path).toBe('/api/v1/search?q=<<0.0.id>>');
    });

    it('resolves a percent-encoded reference in a path and leaves other encodings alone', () => {
      const request = interpolateRequest(
        { method: 'GET', path: '/api/v1/organization/%3C%3C0.0.id%3E%3E/users?q=a%2Fb%20c' },
        context,
      );
      expect(request.path).toBe('/api/v1/organization/org-1/users?q=a%2Fb%20c');
    });

    const pathFor = (id: string, path = '/api/v1/organization/<<0.0.id>>/users') =>
      interpolateRequest({ method: 'GET', path }, { results: [[{ id }]], currentRound: 1 }).path;

    it('encodes a resolved value so it stays one path segment', () => {
      expect(pathFor('a/b')).toBe('/api/v1/organization/a%2Fb/users');
      expect(pathFor('x?admin=1')).toBe('/api/v1/organization/x%3Fadmin%3D1/users');
      expect(pathFor('y#z')).toBe('/api/v1/organization/y%23z/users');
      expect(pathFor('q r')).toBe('/api/v1/organization/q%20r/users');
    });

    it('encodes a resolved value in the query so it stays one value', () => {
      expect(pathFor('a&admin=1', '/api/v1/search?q=<<0.0.id>>')).toBe(
        '/api/v1/search?q=a%26admin%3D1',
      );
    });

    it('refuses a resolved value that would be a dot segment', () => {
      expect(() => pathFor('..')).toThrow("resolved to '..'");
      expect(() => pathFor('.')).toThrow("resolved to '.'");
      expect(pathFor('%2e%2e')).toBe('/api/v1/organization/%252e%252e/users');
      expect(pathFor('..\t')).toBe('/api/v1/organization/..%09/users');
    });

    it('leaves dots inside a segment and resolved values in headers and bodies alone', () => {
      expect(pathFor('v1..2')).toBe('/api/v1/organization/v1..2/users');
      const request = interpolateRequest(
        {
          method: 'POST',
          path: '/api/v1/me',
          headers: { 'x-note': '<<0.0.id>>' },
          body: { name: '<<0.0.id>>' },
        },
        { results: [[{ id: 'a/b?c' }]], currentRound: 1 },
      );
      expect(request.headers?.['x-note']).toBe('a/b?c');
      expect(request.body).toEqual({ name: 'a/b?c' });
    });
  });
});
