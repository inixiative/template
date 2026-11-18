import { describe, expect, it } from 'bun:test';
import { advancedSearchSchemaForFields } from '#/lib/routeTemplates/searchSchema';

describe('advancedSearchSchemaForFields', () => {
  it('should create schema with specified fields', () => {
    const schema = advancedSearchSchemaForFields(['name', 'email']);
    const result = schema.safeParse({ name: 'john', email: 'test@example.com' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'john', email: 'test@example.com' });
    }
  });

  it('should accept any string keys (validation happens in buildWhereClause)', () => {
    const schema = advancedSearchSchemaForFields(['name', 'email']);
    const result = schema.safeParse({ name: 'john', other: 'field' });

    expect(result.success).toBe(true);
  });

  it('should allow partial field usage', () => {
    const schema = advancedSearchSchemaForFields(['name', 'email', 'phone']);
    const result = schema.safeParse({ name: 'john' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'john' });
    }
  });

  it('should allow empty object', () => {
    const schema = advancedSearchSchemaForFields(['name', 'email']);
    const result = schema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });

  it('should allow undefined', () => {
    const schema = advancedSearchSchemaForFields(['name', 'email']);
    const result = schema.safeParse(undefined);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeUndefined();
    }
  });

  it('should handle nested field paths', () => {
    const schema = advancedSearchSchemaForFields(['user.name', 'user.email']);
    const result = schema.safeParse({ 'user.name': 'john' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ 'user.name': 'john' });
    }
  });
});
