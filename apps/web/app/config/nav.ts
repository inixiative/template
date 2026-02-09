import type { PermissionsSlice } from '@template/shared/store/slices/permissions';
import type { NavConfig } from '@template/ui';
import { Building2, Home, Mail, Settings, Users } from 'lucide-react';

export const navConfig: NavConfig = {
  personal: [
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

  organization: [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: Home,
      access: (p, ctx) => (ctx.organization ? p.check('organization', ctx.organization, 'read') : false),
    },
    {
      label: 'Users',
      path: '/users',
      icon: Users,
      access: (p: PermissionsSlice['permissions'], ctx) =>
        ctx.organization ? p.check('organization', ctx.organization, 'read') : false,
    },
    {
      label: 'Communications',
      path: '/communications',
      icon: Mail,
      access: (p, ctx) => (ctx.organization ? p.check('organization', ctx.organization, 'read') : false),
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      access: (p, ctx) => (ctx.organization ? p.check('organization', ctx.organization, 'manage') : false),
    },
  ],

  space: [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: Home,
      access: (p, ctx) => (ctx.space ? p.check('space', ctx.space, 'read') : false),
    },
    {
      label: 'Users',
      path: '/users',
      icon: Users,
      access: (p, ctx) => (ctx.space ? p.check('space', ctx.space, 'read') : false),
    },
    {
      label: 'Communications',
      path: '/communications',
      icon: Mail,
      access: (p, ctx) => (ctx.space ? p.check('space', ctx.space, 'read') : false),
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      access: (p, ctx) => (ctx.space ? p.check('space', ctx.space, 'manage') : false),
    },
  ],
};
