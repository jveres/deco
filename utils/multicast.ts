/**
 * Copyright 2022 Janos Veres. All rights reserved.
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file.
 */

import { Channel, PushAdapter } from "./channel.ts";

/**
 * Multicasts pushed values to a variable number of async iterable iterators
 * as receivers or subscribers.
 *
 * Does not buffer pushed values; if no receivers are registered, pushed
 * values are silently discarded.
 */
export class Multicast<T> implements AsyncIterable<T> {
  onStart?(): void;
  onStop?(): void;
  onReceiverAdded?(): void;
  onReceiverRemoved?(): void;

  readonly receivers: Set<PushAdapter<T>> = new Set();

  constructor(
    private readonly init: () => PushAdapter<T> = () => new Channel(),
  ) {}

  /**
   * Pushes a value to all registered receivers.
   */
  push(value: T): this {
    this.receivers.forEach((channel) => channel.push(value));
    return this;
  }

  /**
   * Number of receivers.
   */
  get size() {
    return this.receivers.size;
  }

  /**
   * Creates and registers a receiver.
   */
  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    const producer = this.init();
    const { receivers } = this;
    receivers.add(producer);
    if (this.onStart && receivers.size === 1) {
      this.onStart();
    }
    this.onReceiverAdded?.();
    return producer.wrap(() => {
      receivers.delete(producer);
      this.onReceiverRemoved?.();
      if (this.onStop && receivers.size === 0) {
        this.onStop();
      }
    });
  }
}
