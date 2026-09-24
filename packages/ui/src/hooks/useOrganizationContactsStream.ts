/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:sdk
 */
import type { OrganizationReadManyContactsResponse } from '@template/sdk';
import { WS_CHANNELS } from '@template/shared/ws';
import { useDataStream } from '@template/ui/hooks/useDataStream';

export const useOrganizationContactsStream = (organizationId: string) =>
  useDataStream<OrganizationReadManyContactsResponse>(WS_CHANNELS.organizationReadManyContacts.name(organizationId));
