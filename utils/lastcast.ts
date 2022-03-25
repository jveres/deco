/**
 * Copyright 2022 Janos Veres. All rights reserved.
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file.
 */

import { DoneResult, PushAdapter } from "./channel.ts";
import { Deferred, deferred } from "https://deno.land/std@0.132.0/async/mod.ts";

export class Lastcast<T> implements PushAdapter<T> {
  #buffer: Deferred<IteratorResult<T>> = deferred();
  #resolved = false;
  #closed = false;

  push(value: T, done = false): Promise<IteratorResult<T>> {
    if (this.#closed) {
      throw new Error("Lastcast channel is closed");
    }
    if (this.#resolved) this.#buffer = deferred();
    this.#buffer.resolve({ value, done });
    this.#resolved = true;
    return this.#buffer;
  }

  next(): Promise<IteratorResult<T>> {
    if (this.#closed) {
      return Promise.resolve(DoneResult);
    }
    return this.#buffer;
  }

  return(value?: T): Promise<IteratorResult<T>> {
    this.#closed = true;
    if (this.#buffer.state === "pending") this.#buffer.resolve(DoneResult);
    return Promise.resolve({
      value: value!,
      done: true,
    });
  }

  wrap(onReturn?: () => void) {
    const wrapped = {
      next: () => this.next(),
      [Symbol.asyncIterator]() {
        return this;
      },
      return: (value?: T) => {
        onReturn?.();
        return this.return(value);
      },
    };
    return wrapped;
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}
