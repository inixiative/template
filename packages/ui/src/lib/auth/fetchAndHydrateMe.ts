import { meRead, type MeReadResponses } from '@template/ui/apiClient';
import { keyBy } from 'lodash-es';
import type { AppStore } from '@template/ui/store/types';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';

type MeData = MeReadResponses[200]['data'];

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

  set((state) => ({
    auth: {
      ...state.auth,
      user,
      organizations: organizationsDict,
      spaces: spacesDict,
      spoofingUserEmail: spoofingEmail && spoofedEmail ? spoofingEmail : null,
      isAuthenticated: true,
      isInitialized: true,
    },
  }));

  await get().permissions.setup(userData);
  return user;
};
