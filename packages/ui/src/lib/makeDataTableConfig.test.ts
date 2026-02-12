import { describe, expect, it } from 'bun:test';
import { makeDataTableConfig } from '@template/ui/lib/makeDataTableConfig';

describe('makeDataTableConfig', () => {
  it('extracts searchable fields from x-searchable-fields', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany');

    expect(config.searchableFields).toContain('name');
    expect(config.searchableFields).toContain('slug');
  });

  it('auto-detects orderable fields from response schema (recursive)', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany');

    expect(config.orderableFields).toContain('name');
    expect(config.orderableFields).toContain('slug');
    expect(config.orderableFields).toContain('createdAt');
    expect(config.orderableFields).toContain('updatedAt');
  });

  it('handles nested object paths in orderable fields', () => {
    const config = makeDataTableConfig('meReadManyOrganizations');

    expect(config.orderableFields).toContain('organizationUser.role');
    expect(config.orderableFields).toContain('organizationUser.organizationId');
  });

  it('excludes array fields from orderable fields', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany');

    const arrayFields = config.orderableFields.filter(
      (f) => f.includes('spaces') || f.includes('users') || f.includes('tokens'),
    );
    expect(arrayFields).toEqual([]);
  });

  it('auto-detects enum filters from schema with in/notin ops', () => {
    const config = makeDataTableConfig('adminInquiryReadMany');

    const statusFilter = config.enumFilters.find((f) => f.field === 'status');
    expect(statusFilter).toBeDefined();
    expect(statusFilter?.values).toContain('draft');
    expect(statusFilter?.values).toContain('sent');
    expect(statusFilter?.values).toContain('resolved');
    expect(statusFilter?.operators).toEqual(['in', 'notin']);
  });

  it('applies boolean canSearch permission', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany', {
      canSearch: false,
    });

    expect(config.canSearch).toBe(false);
  });

  it('applies boolean canOrder permission', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany', {
      canOrder: false,
    });

    expect(config.canOrder).toBe(false);
  });

  it('defaults canSearch and canOrder to true', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany');

    expect(config.canSearch).toBe(true);
    expect(config.canOrder).toBe(true);
  });

  it('sets search mode to combined by default', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany');

    expect(config.searchMode).toBe('combined');
  });

  it('allows overriding search mode to field', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany', {
      searchMode: 'field',
    });

    expect(config.searchMode).toBe('field');
  });

  it('allows custom defaultOrderBy', () => {
    const config = makeDataTableConfig('adminOrganizationReadMany', {
      defaultOrderBy: [{ field: 'createdAt', direction: 'desc' }],
    });

    expect(config.defaultOrderBy).toEqual([{ field: 'createdAt', direction: 'desc' }]);
  });

  it('returns empty config for unknown operation', () => {
    const config = makeDataTableConfig('unknownOperation');

    expect(config.searchableFields).toEqual([]);
    expect(config.orderableFields).toEqual([]);
    expect(config.enumFilters).toEqual([]);
  });

  it('handles operations with no searchable fields', () => {
    const config = makeDataTableConfig('tokenDelete');

    expect(config.searchableFields).toEqual([]);
    expect(config.canSearch).toBe(true);
    expect(config.canOrder).toBe(true);
  });

  it('detects multiple enum filters in same schema', () => {
    const config = makeDataTableConfig('adminInquiryReadMany');

    expect(config.enumFilters.length).toBeGreaterThan(1);

    const typeFilter = config.enumFilters.find((f) => f.field === 'type');
    const statusFilter = config.enumFilters.find((f) => f.field === 'status');

    expect(typeFilter).toBeDefined();
    expect(statusFilter).toBeDefined();
  });
});

