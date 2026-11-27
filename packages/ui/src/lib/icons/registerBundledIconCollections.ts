/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import { addCollection } from '@iconify/react';
import { bundledIconCollections } from '@template/ui/lib/icons/bundledIconCollections.gen';

export const registerBundledIconCollections = () => {
  for (const collection of bundledIconCollections) addCollection(collection);
};
