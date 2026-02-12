import { getQueryMetadataByOperation, type EnumFilter } from '@template/ui/lib/getQueryMetadata';

export type SearchMode = 'combined' | 'field';

export type DataTableConfig = {
  searchableFields: string[];
  searchMode: SearchMode;
  orderableFields: string[];
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  enumFilters: EnumFilter[];
  canSearch: boolean;
  canOrder: boolean;
};

export type DataTableOptions = {
  searchMode?: SearchMode;
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
 * - Enum filters (auto-detected with in/notin ops)
 * - Permission toggles (canSearch, canOrder)
 */
export const makeDataTableConfig = (operationId: string, options?: DataTableOptions): DataTableConfig => {
  const metadata = getQueryMetadataByOperation(operationId);

  return {
    searchableFields: metadata.searchableFields ?? [],
    orderableFields: metadata.orderableFields ?? [],
    enumFilters: metadata.enumFilters ?? [],
    searchMode: options?.searchMode ?? 'combined',
    defaultOrderBy: options?.defaultOrderBy,
    canSearch: options?.canSearch ?? true,
    canOrder: options?.canOrder ?? true,
  };
};
