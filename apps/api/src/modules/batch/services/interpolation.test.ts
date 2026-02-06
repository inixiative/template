import { describe, expect, it } from 'bun:test';
import { interpolateRequest, interpolateValue } from './interpolation';

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
        results: [
          [{ id: 'user-123' }],
          [{ userId: 'user-123', orgId: 'org-456' }],
        ],
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
        context
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
        context
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
      expect(() => interpolateValue('<<5.0.id>>', context)).toThrow('round 5 does not exist (only 1 rounds completed)');
    });

    it('throws error for request index out of bounds', () => {
      const context = {
        results: [[{ id: 'user-123' }, { id: 'user-456' }]],
      };

      expect(() => interpolateValue('<<0.5.id>>', context)).toThrow('Request index out of bounds');
      expect(() => interpolateValue('<<0.10.id>>', context)).toThrow('request 10 does not exist in round 0 (only 2 requests completed)');
    });

    it('throws error for missing field', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<0.0.email>>', context)).toThrow('Field not found in interpolation');
    });

    it('throws error for invalid path notation', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
      };

      expect(() => interpolateValue('<<0.0.a.b.c.d.e.f.g>>', context)).toThrow('Invalid interpolation path');
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

      expect(() => interpolateValue('<<abc.def.field>>', context)).toThrow('Malformed interpolation syntax');
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
      expect(() => interpolateValue('<<1.0.id>>', context)).toThrow('cannot reference round 1 from round 1');
    });

    it('throws error when referencing future round', () => {
      const context = {
        results: [[{ id: 'user-123' }]],
        currentRound: 1,
      };

      expect(() => interpolateValue('<<2.0.id>>', context)).toThrow('Invalid round reference');
      expect(() => interpolateValue('<<5.0.id>>', context)).toThrow('cannot reference round 5 from round 1');
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

    it('interpolates headers', () => {
      const context = {
        results: [[{ token: 'secret-token' }]],
      };

      const request = {
        method: 'GET',
        path: '/api/v1/me',
        headers: {
          'Authorization': 'Bearer <<0.0.token>>',
        },
      };

      const result = interpolateRequest(request, context);
      expect(result.headers).toEqual({
        'Authorization': 'Bearer secret-token',
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
});
