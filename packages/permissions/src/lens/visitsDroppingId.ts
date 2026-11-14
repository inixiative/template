/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses none
 */
import {
  createLens,
  getLensRoot,
  type LensNarrowing,
  type PathProjection,
  projectLens,
} from '@inixiative/json-rules';
import { modelHasId } from '@template/permissions/lens/modelHasId';

const droppingId = (narrowing: LensNarrowing, visits: PathProjection): string[] =>
  Object.entries(visits)
    .filter(([, visit]) => modelHasId(narrowing, visit) && !Object.hasOwn(visit.fields, 'id'))
    .map(([path]) => path);

const defaultsDroppingId = (narrowing: LensNarrowing): string[] => {
  const base = getLensRoot(narrowing);
  return Object.entries(narrowing.mapDefaults ?? {}).flatMap(([mapName, defaults]) =>
    Object.entries(defaults.models ?? {}).flatMap(([model, modelDefaults]) => {
      const atModel: LensNarrowing = {
        parent: createLens({ maps: base.maps, bridges: base.bridges, mapName, model }),
        mapDefaults: { [mapName]: { models: { [model]: modelDefaults } } },
      };
      return droppingId(atModel, projectLens(atModel)).map(
        (path) => `mapDefaults.${mapName}.models.${path}`,
      );
    }),
  );
};

export const visitsDroppingId = (narrowing: LensNarrowing): string[] => [
  ...droppingId(narrowing, projectLens(narrowing)),
  ...defaultsDroppingId(narrowing),
];
