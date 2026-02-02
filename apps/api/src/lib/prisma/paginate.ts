import { Prisma, type AnyDelegate, type Args, type Result } from '@template/db';

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

export const paginate = async <T extends AnyDelegate, A extends Args<T, 'findMany'> & object>(
  delegate: T,
  args: A,
  { page = 1, pageSize = 20 }: PaginationParams,
): Promise<PaginatedResult<Result<T, A, 'findMany'>[number]>> => {
  const orderBy = Array.isArray((args as { orderBy?: unknown }).orderBy)
    ? [...(args as { orderBy: object[] }).orderBy]
    : (args as { orderBy?: object }).orderBy
      ? [(args as { orderBy: object }).orderBy]
      : [];
  if (!orderBy.some((o) => 'id' in o)) orderBy.push({ id: Prisma.SortOrder.desc });

  const [data, total] = await Promise.all([
    delegate.findMany({
      ...args,
      orderBy,
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
