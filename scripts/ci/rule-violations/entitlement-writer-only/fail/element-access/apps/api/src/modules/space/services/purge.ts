import { db } from '@template/db';
export const purge = (spaceId: string) => db['entitlement']['deleteMany']({ where: { sourceId: spaceId } });
