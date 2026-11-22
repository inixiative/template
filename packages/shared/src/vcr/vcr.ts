/**
 * @atlas
 * @kind service
 * @partOf primitive:shared
 * @uses none
 */
import {
  clearVcrVersionCache,
  createVcrRecorder,
  seedVcrServiceVersion,
  type VcrRecorder,
  type VcrRecorderOptions,
  type VcrResponse,
} from '@inixiative/vcr';
import { isTest } from '@template/shared/utils/env';

export class VCR {
  static setVersion(service: string, value: string): void {
    seedVcrServiceVersion(service, value);
  }

  static clearVersionCache(): void {
    clearVcrVersionCache();
  }

  readonly recorder: VcrRecorder;

  constructor(fixturesDir: string, options: VcrRecorderOptions) {
    this.recorder = createVcrRecorder(fixturesDir, options);
  }

  queue(method: string, cassetteName: string): this {
    this.recorder.queue(method, cassetteName);
    return this;
  }

  capture<T>(method: string, executeLive: () => Promise<T>): Promise<T> {
    if (!isTest) return executeLive();
    return this.recorder.capture(method, executeLive);
  }

  captureResponse<T>(
    method: string,
    executeLive: () => Promise<VcrResponse<T>>,
  ): Promise<VcrResponse<T>> {
    if (!isTest) return executeLive();
    return this.recorder.captureResponse(method, executeLive);
  }

  fetchServiceVersion(): Promise<string> {
    return this.recorder.fetchServiceVersion();
  }

  isEmpty(): boolean {
    return this.recorder.isQueueEmpty();
  }

  clear(): void {
    this.recorder.clearQueues();
  }
}
