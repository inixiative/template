/**
 * @atlas
 * @kind constructor
 * @constructs dataConfig
 * @partOf primitive:ui
 * @uses none
 */
import {
  type EnumFilter,
  listFieldsFromOpenApiOperationId,
} from '@template/ui/lib/listFieldsFromOpenApi';

export type ListQueryCapabilities = {
  searchableFields: string[];
  orderableFields: string[];
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  enumFilters: EnumFilter[];
  canSearch: boolean;
  canOrder: boolean;
};

export type ListQueryCapabilitiesOptions = {
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  canSearch?: boolean;
  canOrder?: boolean;
};

export const listQueryCapabilitiesFromOpenApi = (
  operationId: string,
  options?: ListQueryCapabilitiesOptions,
): ListQueryCapabilities => {
  const metadata = listFieldsFromOpenApiOperationId(operationId);
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
