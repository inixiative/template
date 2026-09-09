/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type Db, db as defaultDb, PolymorphismRegistry } from '@template/db';
import { segmentReachedModels } from '#/modules/segment/lib/segmentLens';
import { customerRefCustomerFk } from '#/modules/segment/lib/segmentOwner';

type Row = Record<string, unknown>;

const CUSTOMER_MODELS = ['User', 'Organization', 'Space'] as const;

const idsOf = (rows: Row[]): string[] => rows.map((row) => row.id as string).filter(Boolean);

const byCustomer = async (model: string, ids: string[], db: Db): Promise<string[]> => {
  const fk = customerRefCustomerFk(model);
  if (!fk || !ids.length) return [];
  const refs = await db.customerRef.findMany({ where: { [fk]: { in: ids } } });
  return refs.map((ref) => ref.id);
};

const byPolymorphicOwner = async (model: string, rows: Row[], db: Db): Promise<string[]> => {
  const axis = PolymorphismRegistry[model as keyof typeof PolymorphismRegistry]?.axes[0];
  if (!axis) return [];
  const out: string[] = [];
  for (const customerModel of CUSTOMER_MODELS) {
    const fk = axis.fkMap[customerModel]?.[0];
    if (!fk) continue;
    const ids = rows.map((row) => row[fk] as string | null).filter((id): id is string => !!id);
    out.push(...(await byCustomer(customerModel, ids, db)));
  }
  return out;
};

const byColumn = (column: string) => async (model: string, rows: Row[], db: Db) =>
  byCustomer(
    model,
    rows.map((row) => row[column] as string | null).filter((id): id is string => !!id),
    db,
  );

const resolvers: Record<string, (model: string, rows: Row[], db: Db) => Promise<string[]>> = {
  CustomerRef: async (_model, rows) => idsOf(rows),
  User: (model, rows, db) => byCustomer(model, idsOf(rows), db),
  Organization: (model, rows, db) => byCustomer(model, idsOf(rows), db),
  Space: (model, rows, db) => byCustomer(model, idsOf(rows), db),
  Contact: byPolymorphicOwner,
  TagAttachment: byPolymorphicOwner,
  CommunicationLog: (_model, rows, db) => byColumn('recipientUserId')('User', rows, db),
  Tag: async () => [],
  Segment: async () => [],
  SegmentMember: async () => [],
};

for (const model of segmentReachedModels()) {
  if (!(model in resolvers)) {
    throw new Error(
      `segment lens reaches ${model} but customerRefIdsForRows has no resolver for it; membership would never react to its writes`,
    );
  }
}

export const segmentTriggerModels = new Set(Object.keys(resolvers));

export const customerRefIdsForRows = async (model: string, rows: Row[], db: Db = defaultDb): Promise<string[]> => {
  const resolver = resolvers[model];
  if (!resolver || !rows.length) return [];
  return [...new Set(await resolver(model, rows, db))];
};
