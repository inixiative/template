import type { AccessorName, HydratedRecord } from '@template/db';
import type { Permix } from '@template/permissions/client';
import type { ActionRule } from '@template/permissions/rebac/types';
import type { MeReadResponses } from '@template/ui/apiClient';

type UserWithRelations = MeReadResponses[200]['data'];

export type PermissionsSlice = {
  permissions: {
    permix: Permix;
    check: (model: AccessorName, record: HydratedRecord, action: ActionRule) => boolean;
    setup: (data: UserWithRelations) => Promise<void>;
    clear: () => void;
  };
};
