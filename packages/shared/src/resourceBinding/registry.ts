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
  source: 'Artifact' | 'url' | 'both';
  requiresPublic: boolean;
  media?: ResourceBindingMedia;
};

export const ResourceBindingRegistry = {
  logo: { cardinality: 'single', accepts: ['image'], source: 'both', requiresPublic: true },
  avatar: { cardinality: 'single', accepts: ['image'], source: 'both', requiresPublic: true },
  tracking: { cardinality: 'many', accepts: '*', source: 'Artifact', requiresPublic: false },
} satisfies Record<string, ResourceBindingTypeDef>;

export type ResourceBindingType = keyof typeof ResourceBindingRegistry;

export const ResourceBindings = {
  Organization: ['logo', 'tracking'],
  Space: ['logo', 'tracking'],
  User: ['avatar', 'tracking'],
  CustomerRelationship: ['avatar'],
} satisfies Partial<Record<ResourceBindingResourceModel, ResourceBindingType[]>>;
