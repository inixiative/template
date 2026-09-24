import { resolve } from 'node:path';
import { loadCicdConfig } from './config';

process.stdout.write((await loadCicdConfig(resolve(import.meta.dir, '../..'))).database.strategy);
