import { meReadOptions } from '../apiClient';
import { useAppStore } from '../store';

export async function initializeAuth() {
  const queryClient = useAppStore.getState().api.queryClient;
  const hydrate = useAppStore.getState().auth.hydrate;
  const hydratePermissions = useAppStore.getState().permissions.hydrate;

  try {
    const result = await queryClient.fetchQuery(meReadOptions());

    if (!result.data) {
      throw new Error('No user data returned from /me');
    }

    const { organizationUsers, organizations, spaceUsers, spaces, ...user } = result.data;

    hydrate({
      user,
      session: null,
      organizationUsers,
      organizations,
      spaceUsers,
      spaces,
    });

    await hydratePermissions({
      id: user.id,
      platformRole: user.platformRole,
      organizationUsers,
      spaceUsers,
    });

    return result.data;
  } catch (error) {
    throw error;
  }
}
