/**
 * @atlas
 * @kind fixture
 * @partOf primitive:authz
 * @uses none
 */
import { createLens, type FieldMap, type Lens } from '@inixiative/json-rules';

const scalar = (type: string) => ({ kind: 'scalar' as const, type });
const toMany = (type: string) => ({ kind: 'object' as const, type, isList: true });
const toOne = (type: string) => ({ kind: 'object' as const, type, isList: false });

export const documentsMap: FieldMap = {
  models: {
    Document: {
      fields: {
        id: scalar('String'),
        title: scalar('String'),
        body: scalar('String'),
        public: scalar('Boolean'),
        meta: scalar('Json'),
        author: toOne('Author'),
        items: toMany('Item'),
        logs: toMany('Log'),
      },
    },
    Author: {
      fields: { id: scalar('String'), email: scalar('String'), public: scalar('Boolean') },
    },
    Item: {
      fields: {
        id: scalar('Int'),
        t: scalar('String'),
        s: scalar('String'),
        public: scalar('Boolean'),
        parts: toMany('Part'),
      },
    },
    Part: { fields: { id: scalar('Int'), n: scalar('String'), m: scalar('String') } },
    Log: { fields: { at: scalar('String'), message: scalar('String') } },
  },
};

export const documentsLens = (model = 'Document'): Lens =>
  createLens({ maps: { docs: documentsMap }, mapName: 'docs', model });
