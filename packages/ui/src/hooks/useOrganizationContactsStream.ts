/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { organizationContactsStream } from '@template/db/streams';
import { useStream } from '@template/ui/hooks/useStream';
import { listStreamFolding } from '@template/ui/lib/ws/listStreamFolding';

export const useOrganizationContactsStream = (organizationId: string) =>
  useStream(organizationContactsStream, { id: organizationId }, listStreamFolding);
