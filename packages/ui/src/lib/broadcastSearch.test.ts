import { describe, expect, it } from 'bun:test';
import { broadcastSearch } from '@template/ui/lib/broadcastSearch';

describe('broadcastSearch', () => {
  describe('without model — no filtering, all paths included', () => {
    it('returns undefined for empty term', () => {
      expect(broadcastSearch('', ['name'])).toBeUndefined();
      expect(broadcastSearch('   ', ['name'])).toBeUndefined();
    });

    it('returns undefined for empty paths', () => {
      expect(broadcastSearch('aron', [])).toBeUndefined();
    });

    it('builds an OR of case-insensitive contains across scalar paths', () => {
      expect(broadcastSearch('aron', ['name', 'email'])).toEqual({
        OR: [
          { name: { contains: 'aron', mode: 'insensitive' } },
          { email: { contains: 'aron', mode: 'insensitive' } },
        ],
      });
    });

    it('wraps each intermediate segment in `some` for to-many relations', () => {
      expect(broadcastSearch('foo', ['contacts.valueKey'])).toEqual({
        OR: [{ contacts: { some: { valueKey: { contains: 'foo', mode: 'insensitive' } } } }],
      });
    });

    it('trims whitespace from the search term', () => {
      const result = broadcastSearch('  aron  ', ['name']);
      expect(result).toEqual({ OR: [{ name: { contains: 'aron', mode: 'insensitive' } }] });
    });
  });

  describe('with model — filters to String paths only', () => {
    it('keeps String scalars', () => {
      expect(broadcastSearch('aron', ['name', 'email'], { model: 'User' })).toEqual({
        OR: [
          { name: { contains: 'aron', mode: 'insensitive' } },
          { email: { contains: 'aron', mode: 'insensitive' } },
        ],
      });
    });

    it('drops enum paths (contains is meaningless)', () => {
      const result = broadcastSearch('aron', ['name', 'platformRole'], { model: 'User' });
      expect(result).toEqual({
        OR: [{ name: { contains: 'aron', mode: 'insensitive' } }],
      });
    });

    it('drops DateTime / Boolean / Int paths', () => {
      const result = broadcastSearch(
        'aron',
        ['name', 'createdAt', 'emailVerified'],
        { model: 'User' },
      );
      expect(result).toEqual({
        OR: [{ name: { contains: 'aron', mode: 'insensitive' } }],
      });
    });

    it('keeps String paths through to-many relations', () => {
      expect(broadcastSearch('foo', ['contacts.valueKey'], { model: 'User' })).toEqual({
        OR: [{ contacts: { some: { valueKey: { contains: 'foo', mode: 'insensitive' } } } }],
      });
    });

    it('drops unknown / unresolved paths silently', () => {
      const result = broadcastSearch('foo', ['name', 'notARealField'], { model: 'User' });
      expect(result).toEqual({
        OR: [{ name: { contains: 'foo', mode: 'insensitive' } }],
      });
    });

    it('returns undefined when every path is filtered out', () => {
      expect(broadcastSearch('foo', ['platformRole', 'createdAt'], { model: 'User' })).toBeUndefined();
    });
  });
});
