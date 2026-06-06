#!/usr/bin/env bun

import { type AccessorName, db, type RuntimeDelegate } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';
import { isUuidV7 } from '@template/shared/utils/isUuidV7';
import { omit } from 'lodash-es';
import { seeds } from './seeds';

export type SeedFile<T = Record<string, unknown>> = {
  model: AccessorName;
  records: (Partial<T> & { id: string; prime?: boolean })[];
  createOnly?: boolean;
  updateOmitFields?: string[];
};

const args = process.argv.slice(2);
const targetTable = args.find((arg) => !arg.startsWith('--'));
const includePrime = args.includes('--prime');

const checkUUIDUniqueness = () => {
  const idDictionary: Record<string, Array<{ model: string; record: Record<string, unknown> }>> = {};

  for (const { model, records } of seeds) {
    for (const record of records) {
      const id = record.id as string;

      if (!id) continue;
      if (!isUuidV7(id)) {
        log.error('Invalid uuidv7:', { model, id, record }, LogScope.seed);
        throw new Error('ID must be a valid uuidv7');
      }

      idDictionary[id] = idDictionary[id] || [];
      idDictionary[id].push({ model: String(model), record });
    }
  }

  for (const id in idDictionary) {
    if (idDictionary[id].length === 1) delete idDictionary[id];
  }

  if (Object.entries(idDictionary).length) {
    log.error('Duplicate UUIDs detected:', idDictionary, LogScope.seed);
    throw new Error('Duplicate UUIDs detected');
  }
};

const seedTable = async (seedFile: SeedFile): Promise<void> => {
  const delegate = db[seedFile.model] as unknown as RuntimeDelegate;

  if (!delegate) {
    log.error(`Model not found: ${seedFile.model}`, LogScope.seed);
    return;
  }

  const eligibleRecords = seedFile.records.filter((record) => {
    // Skip prime data in production
    if (record.prime && process.env.NODE_ENV === 'production') return false;

    // Skip prime data unless --prime flag
    if (record.prime && !includePrime) return false;

    return true;
  });

  if (eligibleRecords.length === 0) {
    log.info(`Skipping ${seedFile.model} (no eligible records)`, LogScope.seed);
    return;
  }

  log.info(`Seeding ${seedFile.model} (${eligibleRecords.length} records)...`, LogScope.seed);

  const concurrency = getConcurrency([ConcurrencyType.db]) || 10;

  await resolveAll(
    eligibleRecords.map((record) => async () => {
      const { prime, ...data } = record;
      const id = data.id as string;

      const updateData = seedFile.createOnly ? {} : omit(data, ['id', ...(seedFile.updateOmitFields ?? [])]);

      await delegate.upsert({ where: { id }, create: data, update: updateData });
      log.success(`  - Upserted: ${id}`, LogScope.seed);
    }),
    concurrency,
  );
};

const seed = async () => {
  const isProduction = process.env.NODE_ENV === 'production';

  log.info('Starting database seed...', LogScope.seed);
  if (isProduction) log.warn('Running in PRODUCTION mode', LogScope.seed);
  if (includePrime) log.info('Including PRIME development data', LogScope.seed);
  if (targetTable) log.info(`Target table: ${targetTable}`, LogScope.seed);

  checkUUIDUniqueness();

  for (const seedFile of seeds) {
    if (targetTable && seedFile.model !== targetTable) continue;

    await seedTable(seedFile);
  }

  log.success('Seed completed!', LogScope.seed);
};

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Seed failed:', error, LogScope.seed);
    process.exit(1);
  });
