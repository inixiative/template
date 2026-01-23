import { Context } from 'elysia';

export const usersCurrent = async ({ user }: Context) => {
  return { data: user };
};