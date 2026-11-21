/**
 * @atlas
 * @kind type
 * @partOf primitive:routeTemplates
 * @uses none
 */
import type {
  CursorPaginationMetadata,
  PaginationMetadata,
} from '#/lib/routeTemplates/paginationSchemas';

export type ResponseMetadata =
  | { pagination: PaginationMetadata }
  | { pagination: CursorPaginationMetadata };
