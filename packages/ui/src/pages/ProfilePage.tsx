import { OrganizationProfilePage } from '@template/ui/pages/OrganizationProfilePage';
import { SpaceProfilePage } from '@template/ui/pages/SpaceProfilePage';
import { UserProfilePage } from '@template/ui/pages/UserProfilePage';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';

export const ProfilePage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;

  switch (context.type) {
    case 'organization':
      return <OrganizationProfilePage />;
    case 'space':
      return <SpaceProfilePage />;
    case 'user':
      return <UserProfilePage />;
  }
};
