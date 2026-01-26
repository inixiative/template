import type { SeedFile } from '../seed';
import { userSeeds } from './user.seed';

const seeds: SeedFile[] = [
  // Order matters for FK constraints
  // Users first (no dependencies)
  userSeeds,
];

export default seeds;
