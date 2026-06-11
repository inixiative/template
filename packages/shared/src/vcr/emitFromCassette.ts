/**
 * @atlas
 * @partOf primitive:shared
 */
import { readFileSync } from 'node:fs';
import type { Fixture } from '@template/shared/vcr/vcr';

// Like ev.emit, but awaits async listeners. ev.emit is sync — async handlers' promises
// would be discarded and tests would assert before handlers settle.
type EmitterLike = { listeners: (eventName: string) => Array<(payload: unknown) => unknown> };

export const emitFromCassette = async (ev: EmitterLike, eventName: string, cassettePath: string): Promise<void> => {
  const fixture = JSON.parse(readFileSync(cassettePath, 'utf-8')) as Fixture;
  await Promise.all(ev.listeners(eventName).map((fn) => fn(fixture.body)));
};
