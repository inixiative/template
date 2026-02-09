// User factory for creating test data

type UserOverrides = Partial<{
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
}>;

let userCounter = 0;

export const createUser = (overrides?: UserOverrides) => {
  userCounter++;
  const id = overrides?.id ?? `user-${userCounter}`;

  return {
    id,
    email: overrides?.email ?? `user${userCounter}@test.com`,
    emailVerified: overrides?.emailVerified ?? false,
    name: overrides?.name ?? `Test User ${userCounter}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

export const resetUserFactory = () => {
  userCounter = 0;
};
