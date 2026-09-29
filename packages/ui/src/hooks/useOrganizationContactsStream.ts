/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared, primitive:sdk
 */
import type { OrganizationReadManyContactsResponse } from '@template/sdk';
import { STREAM_DEFINITIONS } from '@template/shared/ws';
import { useStream } from '@template/ui/hooks/useStream';
import type { ListStreamState } from '@template/ui/lib/ws/listStream';

export type OrganizationContactsStream = ListStreamState<OrganizationReadManyContactsResponse['data'][number]>;

export const useOrganizationContactsStream = (organizationId: string) =>
  useStream<OrganizationContactsStream>(STREAM_DEFINITIONS.organizationReadManyContacts.name({ id: organizationId }));
