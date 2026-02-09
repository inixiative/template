import type { AccessorName, HydratedRecord, UserWithRelations } from '@template/db';
import type { ActionRule, Permix } from '@template/permissions';

export type PermissionsSlice = {
  permissions: {
    permix: Permix;
    check: (model: AccessorName, record: HydratedRecord, action: ActionRule) => boolean;
    setup: (data: UserWithRelations) => Promise<void>;
    clear: () => void;
  };
};
