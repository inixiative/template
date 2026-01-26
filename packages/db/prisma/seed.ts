import { omit } from 'lodash-es';
import { db } from '#/index';
import seeds from './seeds';

export type SeedFile = {
  model: string;
  records: Record<string, unknown>[];
  updateOmits?: string[];
  // TODO: Add order nullification for models with unique [parentId, order] constraints
  // See Carde's temporarilyNullifyOrder pattern
};

async function seed() {
  const isProduction = process.env.NODE_ENV === 'production';

  for (const { model, records, updateOmits = [] } of seeds) {
    for (const record of records) {
      const { testData, ...data } = record as { testData?: boolean } & Record<string, unknown>;
      if (testData && isProduction) continue;

      try {
        await (db[model as keyof typeof db] as any).upsert({
          where: { id: data.id },
          create: data,
          update: omit(data, ['id', ...updateOmits]),
        });
      } catch (e) {
        console.error(`Failed to seed ${model}:`, data.id, e);
        throw e;
      }
    }
  }
}

seed()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
