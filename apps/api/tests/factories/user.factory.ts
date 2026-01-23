// User factory for creating test data

type UserOverrides = Partial<{
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  kycStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  region: string;
}>;

let userCounter = 0;

export function createUser(overrides?: UserOverrides) {
  userCounter++;
  const id = overrides?.id ?? `user-${userCounter}`;

  return {
    id,
    email: overrides?.email ?? `user${userCounter}@test.com`,
    emailVerified: overrides?.emailVerified ?? false,
    passwordHash: null,
    name: overrides?.name ?? `Test User ${userCounter}`,
    avatarUrl: null,
    kycStatus: overrides?.kycStatus ?? 'NONE',
    kycProvider: null,
    kycExternalId: null,
    kycVerifiedAt: null,
    region: overrides?.region ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function resetUserFactory() {
  userCounter = 0;
}
