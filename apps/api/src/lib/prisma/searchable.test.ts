import { describe, expect, it } from 'bun:test';
import { searchable } from '#/lib/prisma/searchable';

describe('searchable', () => {
  it('passes through plain strings', () => {
    expect(searchable(['name', 'slug'])).toEqual(['name', 'slug']);
  });

  it('expands a relation object with array value', () => {
    expect(searchable([{ user: ['name', 'email'] }])).toEqual(['user.name', 'user.email']);
  });

  it('expands a relation object with single string value', () => {
    expect(searchable([{ user: 'name' }])).toEqual(['user.name']);
  });

  it('mixes strings and relation objects', () => {
    expect(searchable(['name', 'slug', { user: ['name', 'email'] }])).toEqual([
      'name',
      'slug',
      'user.name',
      'user.email',
    ]);
  });

  it('supports nested relation objects', () => {
    const result = searchable([
      'title',
      { posts: ['status', { author: ['name', 'email'] }] },
    ]);

    expect(result).toEqual(['title', 'posts.status', 'posts.author.name', 'posts.author.email']);
  });

  it('supports deeply nested relations', () => {
    const result = searchable([
      { org: ['name', { members: ['role', { user: ['name'] }] }] },
    ]);

    expect(result).toEqual(['org.name', 'org.members.role', 'org.members.user.name']);
  });

  it('supports multiple relations at same level', () => {
    expect(searchable([{ user: ['name'] }, { org: ['slug'] }])).toEqual(['user.name', 'org.slug']);
  });

  it('supports nested object as single value (not array)', () => {
    expect(searchable([{ user: { profile: ['name', 'avatar'] } }])).toEqual([
      'user.profile.name',
      'user.profile.avatar',
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(searchable([])).toEqual([]);
  });
});
