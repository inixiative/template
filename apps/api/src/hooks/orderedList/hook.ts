import { registerOrderedListCreateHook } from '#/hooks/orderedList/createHook';
import { registerOrderedListUpdateHook } from '#/hooks/orderedList/updateHook';
import { registerOrderedListUpdateManyHook } from '#/hooks/orderedList/updateManyHook';
import { registerOrderedListUpsertHook } from '#/hooks/orderedList/upsertHook';
import { registerOrderedListDeleteHook } from '#/hooks/orderedList/deleteHook';

export const registerOrderedListHook = () => {
  registerOrderedListCreateHook();
  registerOrderedListUpdateHook();
  registerOrderedListUpdateManyHook();
  registerOrderedListUpsertHook();
  registerOrderedListDeleteHook();
};
