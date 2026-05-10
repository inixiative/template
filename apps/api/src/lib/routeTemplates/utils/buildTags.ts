import { Tags } from '#/modules/tags';

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
  if (admin) return [Tags.admin, ...sorted];
  if (internal) return [Tags.internal, ...sorted];
  return sorted;
};
