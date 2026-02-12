import type { PermissionsCheck } from '@template/permissions';
import type { PageContext, TenantContext } from '@template/ui/store/types/tenant';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  path?: string;
  icon?: LucideIcon;
  title?: string | ((context: TenantContext, pageContext?: PageContext) => string);
  description?: string | ((context: TenantContext, pageContext?: PageContext) => string);
  access?: (permissions: PermissionsCheck, context: TenantContext, pageContext?: PageContext) => boolean;
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
