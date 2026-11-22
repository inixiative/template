/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:authz
 */
import type { PermissionsCheck } from '@template/permissions/types';
import type { TenantContext, ViewedRecords } from '@template/ui/store/types/tenant';

type LucideIcon = string;

export type NavItem = {
  label: string;
  path?: string;
  icon?: LucideIcon;
  title?: string | ((context: TenantContext, viewedRecords?: ViewedRecords) => string);
  description?: string | ((context: TenantContext, viewedRecords?: ViewedRecords) => string);
  access?: (
    permissions: PermissionsCheck,
    context: TenantContext,
    viewedRecords?: ViewedRecords,
  ) => boolean;
  alias?: boolean;
  breadcrumbLabel?: (record: Record<string, unknown>) => string;
  items?: NavItem[];
};

export type NavConfig = {
  user: NavItem[];
  organization: NavItem[];
  space: NavItem[];
  public?: NavItem[];
};
