// Mock Prisma client for tests
// This creates a basic mock that can be extended per-test

export type MockPrismaClient = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  session: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  wallet: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// Use Bun's test mock
const vi = {
  fn: () => {
    const fn = (...args: unknown[]) => fn.mock.results[fn.mock.calls.length - 1]?.value;
    fn.mock = { calls: [] as unknown[][], results: [] as { value: unknown }[] };
    fn.mockResolvedValue = (value: unknown) => {
      fn.mock.results.push({ value: Promise.resolve(value) });
      return fn;
    };
    fn.mockReturnValue = (value: unknown) => {
      fn.mock.results.push({ value });
      return fn;
    };
    return fn;
  },
};

export function createMockDb(): MockPrismaClient {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}
