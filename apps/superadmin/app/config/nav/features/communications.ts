import type { NavItem } from '@template/ui/components';
import { getContextParams} from '@template/ui/lib';
import { Mail } from 'lucide-react';

export const communicationsItem: NavItem = {
  label: 'Communications',
  path: '/communications',
  icon: Mail,
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
};
