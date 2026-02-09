import type { SidebarSection } from '@template/ui';
import { Building2, Home, Mail, Settings, Users } from 'lucide-react';

// Superadmin views orgs/spaces as resources, not contexts
// Always stays in platform-level view
export const navConfig: {
  personal: SidebarSection[];
  organization: SidebarSection[];
  space: SidebarSection[];
} = {
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
          label: 'Users',
          path: '/users',
          icon: Users,
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
  // Superadmin doesn't switch contexts - orgs/spaces are resources
  organization: [],
  space: [],
};
