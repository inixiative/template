/**
 * @atlas
 * @kind factory
 * @partOf primitive:ui
 * @uses none
 */
import { type EnumFilter, getQueryMetadataByOperation } from '@template/ui/lib/getQueryMetadata';

export type DataConfig = {
  searchableFields: string[];
  orderableFields: string[];
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  enumFilters: EnumFilter[];
  canSearch: boolean;
  canOrder: boolean;
};

export type DataConfigOptions = {
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  canSearch?: boolean;
  canOrder?: boolean;
};

export const makeDataConfig = (operationId: string, options?: DataConfigOptions): DataConfig => {
  const metadata = getQueryMetadataByOperation(operationId);
  const searchableFields = metadata.searchableFields ?? [];

  return {
    searchableFields,
    orderableFields: metadata.orderableFields ?? [],
    enumFilters: metadata.enumFilters ?? [],
    defaultOrderBy: options?.defaultOrderBy,
    canSearch: options?.canSearch ?? searchableFields.length > 0,
    canOrder: options?.canOrder ?? true,
  };
};
