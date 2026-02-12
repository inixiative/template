import type { NavItem } from '@template/ui/components';
import { getContextParams } from '@template/ui/lib';
import { FolderKanban } from 'lucide-react';

export const spacesItem: NavItem = {
  label: 'Spaces',
  path: '/spaces',
  icon: FolderKanban,
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
};
