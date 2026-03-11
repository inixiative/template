import { describe, expect, it } from 'bun:test';
import { searchableRelation } from '#/lib/prisma/searchableRelation';

describe('searchableRelation', () => {
  it('prefixes fields with relation name', () => {
    expect(searchableRelation('user', ['name', 'email'])).toEqual(['user.name', 'user.email']);
  });

  it('supports nesting via spread', () => {
    const result = searchableRelation('posts', [
      'title',
      ...searchableRelation('author', ['name', 'email']),
    ]);

    expect(result).toEqual(['posts.title', 'posts.author.name', 'posts.author.email']);
  });

  it('supports deep nesting', () => {
    const result = searchableRelation('org', [
      'name',
      ...searchableRelation('members', [
        'role',
        ...searchableRelation('user', ['name']),
      ]),
    ]);

    expect(result).toEqual(['org.name', 'org.members.role', 'org.members.user.name']);
  });

  it('returns empty array for empty fields', () => {
    expect(searchableRelation('user', [])).toEqual([]);
  });

  it('works with single field', () => {
    expect(searchableRelation('user', ['id'])).toEqual(['user.id']);
  });
});
