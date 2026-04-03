import { type EnumFilter, getQueryMetadataByOperation } from '@template/ui/lib/getQueryMetadata';

export type SearchMode = 'combined' | 'field';

export type DataConfig = {
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

export type DataConfigOptions = {
  searchMode?: SearchMode;
  adminMode?: boolean;
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  canSearch?: boolean;
  canOrder?: boolean;
};

/**
 * Create data configuration from API metadata.
 *
 * Reads the OpenAPI spec for the given operation and extracts:
 * - Searchable fields from x-searchable-fields
 * - Orderable fields (auto-detected, recursive, no arrays)
 * - Enum filters (auto-detected with in/notIn ops)
 * - Permission toggles (canSearch, canOrder)
 *
 * Works with usePaginatedData, useInfiniteData, or any consumer
 * that needs to know what an API endpoint supports for filtering.
 */
export const makeDataConfig = (operationId: string, options?: DataConfigOptions): DataConfig => {
  const metadata = getQueryMetadataByOperation(operationId);
  const adminMode = options?.adminMode ?? false;
  const searchableFields = metadata.searchableFields ?? [];

  return {
    searchableFields,
    orderableFields: metadata.orderableFields ?? [],
    enumFilters: metadata.enumFilters ?? [],
    searchMode: options?.searchMode ?? 'combined',
    adminMode,
    defaultOrderBy: options?.defaultOrderBy,
    canSearch: options?.canSearch ?? (!adminMode && searchableFields.length > 0),
    canOrder: options?.canOrder ?? true,
  };
};
