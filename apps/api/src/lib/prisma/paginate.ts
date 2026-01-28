import type { ExtendedPrismaClient, ModelArgs, ModelDelegate, ModelResult } from '@template/db';

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

export const paginate = async <M extends ModelDelegate, A extends ModelArgs<M, 'findMany'>>(
  model: ExtendedPrismaClient[M],
  args: A,
  { page = 1, pageSize = 20 }: PaginationParams,
): Promise<PaginatedResult<ModelResult<M, A, 'findMany'>[number]>> => {
  const delegate = model as { findMany: Function; count: Function };

  const [data, total] = await Promise.all([
    delegate.findMany({
      ...args,
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    delegate.count({ where: (args as { where?: object }).where }),
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
