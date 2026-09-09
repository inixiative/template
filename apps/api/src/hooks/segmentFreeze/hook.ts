import { DbAction, db, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { SegmentMemberSource, SegmentType } from '@template/db/generated/client/enums';
import { castArray } from 'lodash-es';

const flippedToStatic = (segment: Segment, previous: Map<string, Segment>): boolean =>
  segment.type === SegmentType.static && previous.get(segment.id)?.type === SegmentType.dynamic;

export const registerSegmentFreezeHook = () => {
  registerDbHook(
    'segmentFreeze',
    'Segment',
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async (options: HookOptions<Segment>) => {
      const previous = new Map(castArray(options.previous ?? []).map((segment) => [segment.id, segment]));
      const frozen = castArray(options.result ?? []).filter((segment) => flippedToStatic(segment, previous));
      if (!frozen.length) return;
      await db.segmentMember.updateManyAndReturn({
        where: { segmentId: { in: frozen.map((segment) => segment.id) }, source: SegmentMemberSource.rule },
        data: { source: SegmentMemberSource.manual },
      });
    },
  );
};
