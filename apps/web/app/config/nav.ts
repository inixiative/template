import { Home, Users, Settings, BarChart, Building2, Mail } from 'lucide-react';
import type { SidebarSection } from '@ui/components/layout/Sidebar';
import type { PermissionsSlice } from '@template/shared/store/slices/permissions';

type NavConfig = {
  personal: SidebarSection[];
  organization: SidebarSection[];
  space: SidebarSection[];
};

export const navConfig: NavConfig = {
  personal: [
    {
      items: [
        {
          label: 'Dashboard',
          path: '/dashboard',
          icon: Home,
        },
        {
          label: 'Organizations',
          path: '/organizations',
          icon: Building2,
        },
        {
          label: 'Communications',
          path: '/communications',
          icon: Mail,
        },
        {
          label: 'Settings',
          path: '/settings',
          icon: Settings,
        },
      ],
    },
  ],

  organization: [
    {
      items: [
        {
          label: 'Dashboard',
          path: '/org/:organizationId',
          icon: Home,
          can: (p, ctx) =>
            ctx.organization ? p.check('organization', ctx.organization, 'read') : false,
        },
        {
          label: 'Users',
          path: '/org/:organizationId/users',
          icon: Users,
          can: (p: PermissionsSlice['permissions'], ctx) =>
            ctx.organization ? p.check('organization', ctx.organization, 'read') : false,
        },
        {
          label: 'Communications',
          path: '/org/:organizationId/communications',
          icon: Mail,
          can: (p, ctx) =>
            ctx.organization ? p.check('organization', ctx.organization, 'read') : false,
        },
        {
          label: 'Settings',
          path: '/org/:organizationId/settings',
          icon: Settings,
          can: (p, ctx) =>
            ctx.organization ? p.check('organization', ctx.organization, 'manage') : false,
        },
      ],
    },
  ],

  space: [
    {
      items: [
        {
          label: 'Dashboard',
          path: '/org/:organizationId/space/:spaceId',
          icon: Home,
          can: (p, ctx) =>
            ctx.space ? p.check('space', ctx.space, 'read') : false,
        },
        {
          label: 'Users',
          path: '/org/:organizationId/space/:spaceId/users',
          icon: Users,
          can: (p, ctx) =>
            ctx.space ? p.check('space', ctx.space, 'read') : false,
        },
        {
          label: 'Communications',
          path: '/org/:organizationId/space/:spaceId/communications',
          icon: Mail,
          can: (p, ctx) =>
            ctx.space ? p.check('space', ctx.space, 'read') : false,
        },
        {
          label: 'Settings',
          path: '/org/:organizationId/space/:spaceId/settings',
          icon: Settings,
          can: (p, ctx) =>
            ctx.space ? p.check('space', ctx.space, 'manage') : false,
        },
      ],
    },
  ],
};
