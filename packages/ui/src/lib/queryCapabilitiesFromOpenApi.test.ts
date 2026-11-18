import { describe, expect, it } from 'bun:test';
import { queryCapabilitiesFromOpenApi } from '@template/ui/lib/queryCapabilitiesFromOpenApi';

describe('queryCapabilitiesFromOpenApi', () => {
  it('returns lens-derived searchable fields for admin routes', () => {
    const config = queryCapabilitiesFromOpenApi('adminOrganizationReadMany');

    expect(config.searchableFields).toContain('name');
    expect(config.searchableFields).toContain('slug');
  });

  it('includes enum + scalar searchable fields from the lens', () => {
    const config = queryCapabilitiesFromOpenApi('adminInquiryReadMany');

    expect(config.searchableFields).toContain('status');
    expect(config.searchableFields).toContain('type');
  });

  it('derives orderable fields from the lens orderBy enum', () => {
    const config = queryCapabilitiesFromOpenApi('adminOrganizationReadMany');

    expect(config.orderableFields).toContain('name');
    expect(config.orderableFields).toContain('slug');
    expect(config.orderableFields).toContain('createdAt');
    expect(config.orderableFields).toContain('updatedAt');
  });

  it('orderable fields are lens-constrained, not the response shape', () => {
    const config = queryCapabilitiesFromOpenApi('meReadManyOrganizations');

    expect(config.orderableFields).toContain('name');
    // the lens does not make the to-one relation sortable, so it is not offered
    expect(config.orderableFields).not.toContain('organizationUser.role');
  });

  it('excludes array fields from orderable fields', () => {
    const config = queryCapabilitiesFromOpenApi('adminOrganizationReadMany');

    const arrayFields = config.orderableFields.filter(
      (f) => f.includes('spaces') || f.includes('users') || f.includes('tokens'),
    );
    expect(arrayFields).toEqual([]);
  });

  it('auto-detects enum filters from schema with in/notIn ops', () => {
    const config = queryCapabilitiesFromOpenApi('adminInquiryReadMany');

    const statusFilter = config.enumFilters.find((f) => f.field === 'status');
    expect(statusFilter).toBeDefined();
    expect(statusFilter?.values).toContain('draft');
    expect(statusFilter?.values).toContain('sent');
    expect(statusFilter?.values).toContain('changesRequested');
    expect(statusFilter?.operators).toEqual(['in', 'notIn']);
  });

  it('applies boolean canSearch permission', () => {
    const config = queryCapabilitiesFromOpenApi('adminOrganizationReadMany', {
      canSearch: false,
    });

    expect(config.canSearch).toBe(false);
  });

  it('applies boolean canOrder permission', () => {
    const config = queryCapabilitiesFromOpenApi('adminOrganizationReadMany', {
      canOrder: false,
    });

    expect(config.canOrder).toBe(false);
  });

  it('defaults canSearch to true when the route has searchable fields, canOrder to true', () => {
    const config = queryCapabilitiesFromOpenApi('adminOrganizationReadMany');

    expect(config.canSearch).toBe(true);
    expect(config.canOrder).toBe(true);
  });

  it('allows custom defaultOrderBy', () => {
    const config = queryCapabilitiesFromOpenApi('adminOrganizationReadMany', {
      defaultOrderBy: [{ field: 'createdAt', direction: 'desc' }],
    });

    expect(config.defaultOrderBy).toEqual([{ field: 'createdAt', direction: 'desc' }]);
  });

  it('returns empty config for unknown operation', () => {
    const config = queryCapabilitiesFromOpenApi('unknownOperation');

    expect(config.searchableFields).toEqual([]);
    expect(config.orderableFields).toEqual([]);
    expect(config.enumFilters).toEqual([]);
  });

  it('handles operations with no searchable fields', () => {
    const config = queryCapabilitiesFromOpenApi('tokenDelete');

    expect(config.searchableFields).toEqual([]);
    // No searchable fields → canSearch defaults to false (nothing to search against)
    expect(config.canSearch).toBe(false);
    expect(config.canOrder).toBe(true);
  });

  it('detects multiple enum filters in same schema', () => {
    const config = queryCapabilitiesFromOpenApi('adminInquiryReadMany');

    expect(config.enumFilters.length).toBeGreaterThan(1);

    const typeFilter = config.enumFilters.find((f) => f.field === 'type');
    const statusFilter = config.enumFilters.find((f) => f.field === 'status');

    expect(typeFilter).toBeDefined();
    expect(statusFilter).toBeDefined();
  });
});
