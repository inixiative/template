import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@template/db/generated/client/client';
import { Pool } from 'pg';

const createMigrationTable = async (databaseUrl: string) => {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: true,
    },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$executeRawUnsafe(`
			CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
				"id" VARCHAR(36) PRIMARY KEY NOT NULL,
				"checksum" VARCHAR(64) NOT NULL,
				"finished_at" TIMESTAMPTZ,
				"migration_name" VARCHAR(255) NOT NULL,
				"logs" TEXT,
				"rolled_back_at" TIMESTAMPTZ,
				"started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
				"applied_steps_count" INTEGER NOT NULL DEFAULT 0
			);
		`);
    console.log('Migration table created successfully');
  } catch (error) {
    console.error('Failed to create migration table:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

const databaseUrl = process.argv[2];
if (!databaseUrl) {
  console.error('Usage: bun init-migration-table.ts <DATABASE_URL>');
  process.exit(1);
}

await createMigrationTable(databaseUrl);
