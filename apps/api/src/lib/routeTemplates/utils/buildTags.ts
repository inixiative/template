import { Tags } from '#/modules/tags';

type BuildTagsArgs = {
  model: string;
  submodel?: string;
  tags?: string[];
  admin?: boolean;
};

export const buildTags = ({ model, submodel, tags, admin }: BuildTagsArgs): string[] => {
  const baseTags = tags ?? [submodel || model];
  const sorted = [...baseTags].sort((a, b) => a.localeCompare(b));
  return admin ? [Tags.admin, ...sorted] : sorted;
};
