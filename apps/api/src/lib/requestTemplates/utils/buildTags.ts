type BuildTagsArgs = {
  model: string;
  submodel?: string;
  tags?: string[];
  admin?: boolean;
};

export const buildTags = ({ model, submodel, tags, admin }: BuildTagsArgs): string[] => {
  const baseTags = tags ?? [submodel || model];
  return admin ? ['Admin', ...baseTags] : baseTags;
};
