import { mock } from 'bun:test';
import type {
  PlanetScaleBranch,
  PlanetScaleDatabase,
  PlanetScaleRegion,
} from '../../api/planetscale';
import { VCR } from './VCR';

type PlanetScalePassword = {
  id: string;
  name: string;
  username: string;
  plain_text: string;
  connection_strings: { general: string };
};

type PlanetScaleOrganization = {
  name: string;
  slug?: string;
};

export const createMockPlanetScale = () => {
  const orgsVcr = new VCR<PlanetScaleOrganization[]>();
  const regionsVcr = new VCR<PlanetScaleRegion[]>();
  const databaseVcr = new VCR<PlanetScaleDatabase>();
  const branchVcr = new VCR<PlanetScaleBranch>();
  const roleVcr = new VCR<PlanetScalePassword>();
  const passwordVcr = new VCR<PlanetScalePassword>();

  const mocks = {
    listOrganizations: mock(async () => orgsVcr.require()),
    listRegions: mock(async (_org: string) => regionsVcr.require()),
    getOrganization: mock(async (_org: string) => ({ name: _org })),
    createDatabase: mock(async () => databaseVcr.require()),
    getDatabase: mock(async () => databaseVcr.require()),
    updateDatabaseSettings: mock(async () => {}),
    listDatabases: mock(async () => []),
    createBranch: mock(async () => branchVcr.require()),
    getBranch: mock(async () => branchVcr.require()),
    listBranches: mock(async () => []),
    renameBranch: mock(async () => branchVcr.require()),
    deleteBranch: mock(async () => {}),
    promoteBranch: mock(async () => branchVcr.require()),
    createRole: mock(async () => roleVcr.require()),
    createPassword: mock(async () => passwordVcr.require()),
    listPasswords: mock(async () => []),
    createServiceToken: mock(async () => ({ id: 'svc-token-id', token: 'svc-token-value' })),
  };

  return {
    mocks,
    vcr: { orgs: orgsVcr, regions: regionsVcr, database: databaseVcr, branch: branchVcr, role: roleVcr, password: passwordVcr },
    /** Install as mock.module — call before importing setup code */
    install: () => {
      mock.module('../../api/planetscale', () => mocks);
    },
    clearAll: () => {
      for (const fn of Object.values(mocks)) fn.mockClear();
      for (const vcr of Object.values({ orgs: orgsVcr, regions: regionsVcr, database: databaseVcr, branch: branchVcr, role: roleVcr, password: passwordVcr })) vcr.clear();
    },
  };
};

export type MockPlanetScale = ReturnType<typeof createMockPlanetScale>;
