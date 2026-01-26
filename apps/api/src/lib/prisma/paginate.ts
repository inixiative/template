import type { Prisma } from '@template/db';

type PaginationParams = {
  page?: number;
  pageSize?: number;
};

type PaginationResult = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type PaginatedResult<T> = {
  data: T[];
  pagination: PaginationResult;
};

export const paginate = async <T, W>(
  model: {
    findMany(...args: unknown[]): Prisma.PrismaPromise<T[]>;
    count(...args: unknown[]): Prisma.PrismaPromise<number>;
  },
  args: { where?: W; orderBy?: unknown; include?: unknown; select?: unknown; omit?: unknown },
  { page = 1, pageSize = 20 }: PaginationParams,
): Promise<PaginatedResult<T>> => {
  const [data, total] = await Promise.all([
    model.findMany({
      ...args,
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    model.count({ where: args.where }),
  ]);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};
