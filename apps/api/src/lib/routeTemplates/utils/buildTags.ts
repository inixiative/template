/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { OpenApiTags } from '#/modules/openApiTags';

type BuildTagsArgs = {
  model: string;
  submodel?: string;
  tags?: string[];
  admin?: boolean;
  internal?: boolean;
};

export const buildTags = ({ model, submodel, tags, admin, internal }: BuildTagsArgs): string[] => {
  const baseTags = tags ?? [submodel || model];
  const sorted = [...baseTags].sort((a, b) => a.localeCompare(b));
  if (admin) return [OpenApiTags.admin, ...sorted];
  if (internal) return [OpenApiTags.internal, ...sorted];
  return sorted;
};
