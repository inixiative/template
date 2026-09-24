import { describe, expect, it } from 'bun:test';
import { createFramePacer } from '@template/ui/lib/ws/framePacer';

const pacerFor = (options: { maxInFlight: number; maxPerWindow: number; windowMs: number }) => {
  const sent: Array<Record<string, unknown>> = [];
  return { sent, pacer: createFramePacer({ send: (frame) => sent.push(frame), ...options }) };
};

describe('createFramePacer', () => {
  it('keeps at most maxInFlight frames unanswered and sends the next as each settles', () => {
    const { sent, pacer } = pacerFor({ maxInFlight: 2, maxPerWindow: 100, windowMs: 1_000 });
    for (let n = 0; n < 5; n++) pacer.enqueue({ n });

    expect(sent).toEqual([{ n: 0 }, { n: 1 }]);
    pacer.settle();
    expect(sent.map((frame) => frame.n)).toEqual([0, 1, 2]);
  });

  it('holds frames past the per-window rate and releases them when the window rolls', async () => {
    const { sent, pacer } = pacerFor({ maxInFlight: 100, maxPerWindow: 2, windowMs: 30 });
    for (let n = 0; n < 5; n++) pacer.enqueue({ n });

    expect(sent).toHaveLength(2);
    await new Promise((resolve) => setTimeout(resolve, 45));
    expect(sent).toHaveLength(4);
  });

  it('calls onSent when the frame actually goes out, not when it is queued', () => {
    const { pacer } = pacerFor({ maxInFlight: 1, maxPerWindow: 100, windowMs: 1_000 });
    const sentAt: number[] = [];
    pacer.enqueue({ n: 0 }, () => sentAt.push(0));
    pacer.enqueue({ n: 1 }, () => sentAt.push(1));

    expect(sentAt).toEqual([0]);
    pacer.settle();
    expect(sentAt).toEqual([0, 1]);
  });

  it('cancels queued frames and clears the queue without forgetting what is in flight', () => {
    const { sent, pacer } = pacerFor({ maxInFlight: 1, maxPerWindow: 100, windowMs: 1_000 });
    pacer.enqueue({ n: 0 });
    pacer.enqueue({ n: 1 });
    pacer.enqueue({ n: 2 });
    pacer.cancel((frame) => frame.n === 1);
    pacer.settle();
    expect(sent.map((frame) => frame.n)).toEqual([0, 2]);

    pacer.enqueue({ n: 3 });
    pacer.clearQueued();
    pacer.settle();
    expect(sent.map((frame) => frame.n)).toEqual([0, 2]);
  });
});
