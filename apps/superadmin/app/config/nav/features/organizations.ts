import type { NavItem } from '@template/ui/components';
import { getContextParams} from '@template/ui/lib';
import { Building2 } from 'lucide-react';

export const organizationsItem: NavItem = {
  label: 'Organizations',
  path: '/organizations',
  icon: Building2,
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
};
