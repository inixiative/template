/**
 * @atlas
 * @kind factory
 * @partOf primitive:ui
 */
import { type EnumFilter, getQueryMetadataByOperation } from '@template/ui/lib/getQueryMetadata';

export type SearchMode = 'combined' | 'field';

export type DataConfig = {
  searchableFields: string[];
  searchMode: SearchMode;
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
