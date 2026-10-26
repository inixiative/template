import { auth } from '#/lib/auth';

export const actAsUser = async (userId: string) => {
  const adapter = (await auth.$context).internalAdapter;
  return adapter.createSession(userId);
};
