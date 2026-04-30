import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';

export const communicationsItem: NavItem = {
  label: 'Communications',
  path: '/communications',
  icon: 'lucide:mail',
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
  items: [
    {
      label: 'Inquiries',
      path: '/inquiries',
      items: [
        { label: 'Sent', path: '/sent' },
        { label: 'Received', path: '/received' },
      ],
    },
  ],
};
