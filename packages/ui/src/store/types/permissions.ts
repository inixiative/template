import type { AccessorName, HydratedRecord } from '@template/db';
import type { ActionRule, Permix } from '@template/permissions';
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
