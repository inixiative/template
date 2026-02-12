#!/usr/bin/env bun

/**
 * Database Seed Script
 *
 * Flags:
 * - prime: Prime development seed (3 users, org, space, tokens, passwords)
 *
 * Usage:
 *   bun run db:seed                    # Seed all non-prime data
 *   bun run db:seed --prime            # Include prime development data
 *   bun run db:seed user               # Seed specific table
 */

import { type AccessorName, db, type RuntimeDelegate } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { ConcurrencyType, getConcurrency } from '@template/shared/utils/concurrency';
import { resolveAll } from '@template/shared/utils/resolveAll';
import { omit } from 'lodash-es';
import { validate as isUUID, version as uuidVersion } from 'uuid';
import { seeds } from './seeds';

export type SeedFile<T = Record<string, unknown>> = {
  /** Prisma model accessor name */
  model: AccessorName;

  /** Records to seed (all must have 'id' field) */
  records: (Partial<T> & { id: string; prime?: boolean })[];

  /** If true, only insert new records - never update existing */
  createOnly?: boolean;

  /** Fields to exclude from update (e.g., 'createdAt') */
  updateOmitFields?: string[];
};

const args = process.argv.slice(2);
const targetTable = args.find((arg) => !arg.startsWith('--'));
const includePrime = args.includes('--prime');

/**
 * Check for duplicate UUIDs across all seeds
 */
const checkUUIDUniqueness = () => {
  const idDictionary: Record<string, Array<{ model: string; record: Record<string, unknown> }>> = {};

  for (const { model, records } of seeds) {
    for (const record of records) {
      const id = record.id as string;

      if (!id) continue;
      if (!isUUID(id)) {
        log.error(`Invalid UUID in ${model}:`, LogScope.seed);
        console.error(model, id, record);
        throw new Error('ID is not a valid UUID');
      }
      if (uuidVersion(id) !== 7) {
        log.error(`Invalid UUID version in ${model} (must be v7):`, LogScope.seed);
        console.error(model, id, record);
        throw new Error(`ID must be UUIDv7, got v${uuidVersion(id)}`);
      }

      idDictionary[id] = idDictionary[id] || [];
      idDictionary[id].push({ model: String(model), record });
    }
  }

  // Remove single entries, keep only duplicates
  for (const id in idDictionary) {
    if (idDictionary[id].length === 1) delete idDictionary[id];
  }

  if (Object.entries(idDictionary).length) {
    log.error('Duplicate UUIDs detected:', LogScope.seed);
    console.error(idDictionary);
    throw new Error('Duplicate UUIDs detected');
  }
};

/**
 * Seed a single table
 */
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
      // Remove meta fields
      const { prime, ...data } = record;
      const id = data.id as string;

      try {
        const existing = await delegate.findFirst({ where: { id } });

        if (existing) {
          if (seedFile.createOnly) {
            log.info(`  - Skipped (createOnly): ${id}`, LogScope.seed);
            return;
          }

          // Update existing record
          const updateData = seedFile.updateOmitFields
            ? omit(data, ['id', ...seedFile.updateOmitFields])
            : omit(data, ['id']);

          await delegate.update({
            where: { id },
            data: updateData,
          });
          log.success(`  - Updated: ${id}`, LogScope.seed);
        } else {
          // Create new record
          await delegate.create({ data });
          log.success(`  - Created: ${id}`, LogScope.seed);
        }
      } catch (error) {
        log.error(`  - Error seeding: ${id}`, LogScope.seed);
        throw error;
      }
    }),
    concurrency,
  );
};

/**
 * Main seed function
 */
const seed = async () => {
  const isProduction = process.env.NODE_ENV === 'production';

  log.info('Starting database seed...', LogScope.seed);
  if (isProduction) log.warn('Running in PRODUCTION mode', LogScope.seed);
  if (includePrime) log.info('Including PRIME development data', LogScope.seed);
  if (targetTable) log.info(`Target table: ${targetTable}`, LogScope.seed);

  // Validate UUID uniqueness
  checkUUIDUniqueness();

  // Seed tables in order
  for (const seedFile of seeds) {
    if (targetTable && seedFile.model !== targetTable) continue;

    await seedTable(seedFile);
  }

  log.success('Seed completed!', LogScope.seed);
};

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Seed failed:', LogScope.seed);
    console.error(error);
    process.exit(1);
  });
