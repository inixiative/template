import { getQueryMetadataByOperation, type QueryMetadata } from '@template/shared/lib/getQueryMetadata';

export type SearchMode = 'combined' | 'field';

export type EnumFilter = {
  field: string;
  values: string[];
  operators: ['in', 'notin'];
};

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
 *
 * @example
 * const config = makeDataTableConfig('adminOrganizationReadMany', {
 *   canSearch: permissions.check('Organization', record, 'search'),
 *   canOrder: permissions.check('Organization', record, 'order'),
 *   searchMode: 'field',
 * });
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

/**
 * React hook version of makeDataTableConfig.
 *
 * @example
 * function OrganizationsTable() {
 *   const hasSearchPermission = usePermission('Organization', record, 'search');
 *   const config = useDataTableConfig('adminOrganizationReadMany', {
 *     canSearch: hasSearchPermission.show,
 *     searchMode: 'field',
 *   });
 *
 *   return (
 *     <DataTable
 *       searchable={config.canSearch}
 *       searchableFields={config.searchableFields}
 *       orderable={config.canOrder}
 *       orderableFields={config.orderableFields}
 *       enumFilters={config.enumFilters}
 *     />
 *   );
 * }
 */
export const useDataTableConfig = (operationId: string, options?: DataTableOptions): DataTableConfig => {
  return makeDataTableConfig(operationId, options);
};
