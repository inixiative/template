import { prismaModelToElysiaSchema } from 'src/app/core/schemas/prismaToElysia';

export const userSchema = prismaModelToElysiaSchema('User');

export const userWithAccountsSchema = prismaModelToElysiaSchema('User', {
  accounts: true
});