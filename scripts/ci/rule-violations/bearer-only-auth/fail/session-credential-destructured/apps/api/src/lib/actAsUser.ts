import { auth } from '#/lib/auth';

export const actAsUser = async (userId: string) => {
  const { internalAdapter } = await auth.$context;
  return internalAdapter.createSession(userId);
};
