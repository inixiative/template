/**
 * @atlas
 * @kind constructor
 * @constructs dataConfig
 * @partOf primitive:ui
 * @uses none
 */
import { type EnumFilter, fieldsFromOpenApiOperationId } from '@template/ui/lib/fieldsFromOpenApi';

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

export const queryCapabilitiesFromOpenApi = (
  operationId: string,
  options?: ListQueryCapabilitiesOptions,
): ListQueryCapabilities => {
  const metadata = fieldsFromOpenApiOperationId(operationId);
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
