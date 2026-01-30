import { omit } from 'lodash-es';
import { log, LogScope } from '@template/shared/logger';
import { db, type ModelDelegate } from '#/index'
import seeds from './seeds';

export type SeedFile = {
  model: ModelDelegate;
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
        const delegate = db[model] as { upsert: Function };
        await delegate.upsert({
          where: { id: data.id },
          create: data,
          update: omit(data, ['id', ...updateOmits]),
        });
      } catch (e) {
        log.error(`Failed to seed ${model}: ${data.id}`, LogScope.seed);
        throw e;
      }
    }
  }
}

seed()
  .then(() => {
    log.success('Seed completed', LogScope.seed);
    process.exit(0);
  })
  .catch((e) => {
    log.error('Seed failed', LogScope.seed);
    process.exit(1);
  });
