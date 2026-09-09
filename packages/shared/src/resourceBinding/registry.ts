/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses infrastructure:prisma
 */
import type { ResourceBindingResourceModel } from '@template/db/generated/client/enums';

export type FileKind = 'image' | 'document' | 'video' | 'audio' | 'archive';

export type ResourceBindingMedia = {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'cover' | 'contain';
  aspectRatio?: string;
};

export type ResourceBindingTypeDef = {
  cardinality: 'single' | 'many';
  accepts: FileKind[] | '*';
  source: 'File' | 'url' | 'both';
  requiresPublic: boolean;
  media?: ResourceBindingMedia;
};

// Canonical binding-type vocabulary. `ResourceBinding.bindingType` is a key here.
// Start minimal; extend as resources need it (fork-extensible).
export const ResourceBindingRegistry = {
  logo: { cardinality: 'single', accepts: ['image'], source: 'both', requiresPublic: true },
  avatar: { cardinality: 'single', accepts: ['image'], source: 'both', requiresPublic: true },
} satisfies Record<string, ResourceBindingTypeDef>;

export type ResourceBindingType = keyof typeof ResourceBindingRegistry;

// Which binding types each resource may carry.
export const ResourceBindings = {
  Organization: ['logo'],
  Space: ['logo'],
  User: ['avatar'],
  CustomerRef: ['avatar'],
} satisfies Partial<Record<ResourceBindingResourceModel, ResourceBindingType[]>>;
