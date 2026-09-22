/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { ProviderModel } from '@template/db/generated/client/enums';
import { WS_CHANNELS } from '@template/shared/ws';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { refetch } from '#/appEvents/refetch';

export type FeatureFlagChangedPayload = { ownerModel: ProviderModel; ownerId: string; slug: string };

export const featureFlagChanged = makeAppEvent<FeatureFlagChangedPayload>({
  websocket: () => [
    {
      target: { channels: [WS_CHANNELS.meReadManyFeatureFlags.name()] },
      message: { data: refetch({ _id: 'meReadManyFeatureFlags' }) },
    },
  ],
});
