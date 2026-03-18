import { type MeReadResponses, meRead } from '@template/ui/apiClient';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import type { AppStore } from '@template/ui/store/types';
import { keyBy } from 'lodash-es';

type _MeData = MeReadResponses[200]['data'];

export const fetchAndHydrateMe = async (
  set: (partial: AppStore | Partial<AppStore> | ((state: AppStore) => AppStore | Partial<AppStore>)) => void,
  get: () => AppStore,
) => {
  const spoofUserEmail = get().auth.spoofUserEmail;
  const { data, response } = await apiFetchInternal(
    (requestOptions) => meRead({ ...requestOptions, throwOnError: true }),
    { spoofUserEmail },
  )();
  if (!data) {
    throw new Error('Failed to hydrate user');
  }
  const userData = data;

  const spoofingEmail = response.headers.get('x-spoofing-user-email');
  const spoofedEmail = response.headers.get('x-spoofed-user-email');

  const { organizationUsers, organizations, spaceUsers, spaces, ...user } = userData;
  const organizationsDict = keyBy(organizations || [], 'id');
  const spacesDict = keyBy(spaces || [], 'id');
  const spaceUsersDict = keyBy(spaceUsers || [], 'spaceId');

  set((state) => ({
    auth: {
      ...state.auth,
      user,
      organizations: organizationsDict,
      spaces: spacesDict,
      spaceUsers: spaceUsersDict,
      spoofingUserEmail: spoofingEmail && spoofedEmail ? spoofingEmail : null,
      isAuthenticated: true,
      isInitialized: true,
    },
  }));

  await get().permissions.setup(userData);
  return user;
};
