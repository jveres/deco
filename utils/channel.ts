/**
 * Copyright 2022 Janos Veres. All rights reserved.
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file.
 */

import { Queue } from "./queue.ts";
import { Deferred, deferred } from "https://deno.land/std@0.132.0/async/mod.ts";

export interface PushAdapter<T> extends AsyncIterableIterator<T> {
  push(value: T): Promise<IteratorResult<T>>;
  wrap(onReturn?: () => void): AsyncIterableIterator<T>;
}

interface Unpushed<T> {
  result: IteratorResult<T>;
  defer: Deferred<IteratorResult<T>>;
}

/** The result returned from closed iterators. */
export const DoneResult: IteratorReturnResult<boolean> = {
  value: undefined!,
  done: true,
};

/**
 * Async iterable iterator with a non-optional [[return]] method.
 */
interface WrappedChannel<T> extends AsyncIterableIterator<T> {
  // TODO the result can be undefined as well
  return(value?: T): Promise<IteratorResult<T>>;
  throw?: undefined;
}

export class Channel<T> implements PushAdapter<T> {
  /** Pushed results waiting for pulls to resolve */
  readonly pushBuffer: Queue<Unpushed<T>>;
  /** Unresolved pulls waiting for results to be pushed */
  readonly pullBuffer: Queue<Deferred<IteratorResult<T>>>;
  /** Determines whether new values can be pushed or pulled */
  #closed = false;

  constructor({ pushLimit = 0, pullLimit = 0 } = {}) {
    this.pushBuffer = new Queue({ limit: pushLimit });
    this.pullBuffer = new Queue({ limit: pullLimit });
  }

  /**
   * Pull a promise of the next [[Result]].
   */
  next(): Promise<IteratorResult<T>> {
    if (this.#closed) {
      return Promise.resolve(DoneResult);
    }
    if (this.pushBuffer.size === 0) {
      const defer = deferred<IteratorResult<T>>();
      // Buffer the pull to be resolved later
      this.pullBuffer.enqueue(defer);
      // Return the buffered promise that will be resolved and dequeued when a value is pushed
      return defer;
    }
    const { result, defer } = this.pushBuffer.dequeue()!;
    defer.resolve(result);
    if (result.done) {
      this.close();
    }
    return defer;
  }

  /**
   * Push the next [[Result]] value.
   *
   * @param value
   * @param done If true, closes the balancer when this result is resolved
   * @throws Throws if the balancer is already closed
   */
  push(value: T, done = false): Promise<IteratorResult<T>> {
    if (this.#closed) {
      return Promise.resolve(DoneResult);
    }
    const result = {
      value,
      done,
    };
    if (this.pullBuffer.size > 0) {
      return this.pullBuffer.dequeue()!.resolve(result)!;
    }
    const defer = deferred<IteratorResult<T>>();
    this.pushBuffer.enqueue({ result, defer });
    return defer;
  }

  /**
   * Returns itself, since [[Channel]] already implements the iterator protocol.
   */
  [Symbol.asyncIterator]() {
    return this;
  }

  /**
   * Closes the channel; clears the queues and makes [[Channel.next]] only
   * return [[closedResult]].
   *
   * @param value The result value to be returned
   */
  return(value?: T): Promise<IteratorResult<T>> {
    this.close();
    return Promise.resolve({
      done: true,
      value: value,
    });
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    // Clear the queues
    this.pushBuffer.forEach(({ defer: { resolve } }) => resolve(DoneResult));
    this.pushBuffer.clear();
    this.pullBuffer.forEach(({ resolve }) => resolve(DoneResult));
    this.pullBuffer.clear();
  }

  /**
   * Convert [[Channel]] to a generic async iterable iterator to hide implementation details.
   *
   * @param onReturn Optional callback for when the iterator is closed with [[Channel.return]]
   * @throws Throws if called when closed
   */
  wrap(onReturn?: () => void): WrappedChannel<T> {
    if (this.#closed) {
      throw new Error("Channel is closed");
    }
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: () => this.next(),
      return: (value?: T) => {
        onReturn?.();
        return this.return(value);
      },
    };
  }
}
