import { type EnumFilter, getQueryMetadataByOperation } from '@template/ui/lib/getQueryMetadata';

export type SearchMode = 'combined' | 'field';

export type DataTableConfig = {
  searchableFields: string[];
  searchMode: SearchMode;
  /** Admin mode: filters serialize under filters[...] (direct Prisma, no validation).
   *  Non-admin: serializes under searchFields[...] (validated against searchableFields). */
  adminMode: boolean;
  orderableFields: string[];
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  enumFilters: EnumFilter[];
  canSearch: boolean;
  canOrder: boolean;
};

export type DataTableOptions = {
  searchMode?: SearchMode;
  adminMode?: boolean;
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  canSearch?: boolean;
  canOrder?: boolean;
};

/**
 * Create DataTable configuration from API metadata.
 *
 * Features:
 * - Searchable fields from x-searchable-fields
 * - Orderable fields (auto-detected, recursive, no arrays)
 * - Enum filters (auto-detected with in/notIn ops)
 * - Permission toggles (canSearch, canOrder)
 */
export const makeDataTableConfig = (operationId: string, options?: DataTableOptions): DataTableConfig => {
  const metadata = getQueryMetadataByOperation(operationId);

  return {
    searchableFields: metadata.searchableFields ?? [],
    orderableFields: metadata.orderableFields ?? [],
    enumFilters: metadata.enumFilters ?? [],
    searchMode: options?.searchMode ?? 'combined',
    adminMode: options?.adminMode ?? false,
    defaultOrderBy: options?.defaultOrderBy,
    canSearch: options?.canSearch ?? true,
    canOrder: options?.canOrder ?? true,
  };
};
