import { auth } from '#/lib/auth';

export const actAsUser = async (userId: string) =>
  (await auth.$context)['internalAdapter']['createSession'](userId);
