import { Pool } from 'pg';

const testConnection = async (connectionString: string) => {
  console.log('Testing connection to PlanetScale...');
  console.log('Connection string:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: true,
    },
  });

  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    console.log('✓ Connected successfully!');

    console.log('Testing simple query...');
    const result = await client.query('SELECT version()');
    console.log('✓ Query succeeded:', result.rows[0]);

    client.release();
    return true;
  } catch (error) {
    console.error('✗ Connection failed:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    await pool.end();
  }
};

const connectionString = process.argv[2];
if (!connectionString) {
  console.error('Usage: bun test-planetscale-connection.ts <CONNECTION_STRING>');
  process.exit(1);
}

await testConnection(connectionString);
