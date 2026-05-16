import { registerOrderedListCreateHook } from '#/hooks/orderedList/createHook';
import { registerOrderedListDeleteHook } from '#/hooks/orderedList/deleteHook';
import { registerOrderedListUpdateHook } from '#/hooks/orderedList/updateHook';
import { registerOrderedListUpdateManyHook } from '#/hooks/orderedList/updateManyHook';
import { registerOrderedListUpsertHook } from '#/hooks/orderedList/upsertHook';

export const registerOrderedListHook = () => {
  registerOrderedListCreateHook();
  registerOrderedListUpdateHook();
  registerOrderedListUpdateManyHook();
  registerOrderedListUpsertHook();
  registerOrderedListDeleteHook();
};
