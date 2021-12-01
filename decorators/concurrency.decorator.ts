// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import { stringFromPropertyKey } from "../utils/utils.ts";

interface QueueNode<T> {
  value: T;
  next: QueueNode<T> | undefined;
}

class Queue<T> {
  #source: AsyncIterator<T>;
  #queue: QueueNode<T>;
  head: QueueNode<T>;

  done: boolean;

  constructor(iterable: AsyncIterable<T>) {
    this.#source = iterable[Symbol.asyncIterator]();
    this.#queue = {
      value: undefined!,
      next: undefined,
    };
    this.head = this.#queue;
    this.done = false;
  }

  async next(): Promise<void> {
    const result = await this.#source.next();
    if (!result.done) {
      const nextNode: QueueNode<T> = {
        value: result.value,
        next: undefined,
      };
      this.#queue.next = nextNode;
      this.#queue = nextNode;
    } else {
      this.done = true;
    }
  }
}

function queuedIterator<T>(iterable: AsyncIterable<T>, callback: Function) {
  return {
    queue: new Queue<T>(iterable),
    generator: async function* () {
      let buffer = this.queue.head;
      while (true) {
        if (buffer.next) {
          buffer = buffer.next;
          yield buffer.value;
        } else if (this.queue.done) {
          callback();
          return;
        } else {
          await this.queue.next();
        }
      }
    },
    [Symbol.asyncIterator]() {
      return this.generator();
    },
  };
}

interface ConcurrencyPoolItem {
  key: string;
  value: any;
}

export const Concurrency = ({ limit = 1, resolver }: {
  limit?: number;
  resolver?: (...args: any[]) => string;
} = {}) => {
  return function <
    T extends (...args: any[]) => Promise<any> | AsyncIterable<any>,
  >(
    _target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const fn = descriptor.value!;
    const concurrencyPool: ConcurrencyPoolItem[] = [];
    const removeFromPool = (key: string) => {
      const index = concurrencyPool.findIndex((item) => item.key === key);
      if (index > -1) concurrencyPool.splice(index, 1);
    };
    descriptor.value = <T> function (this: unknown, ...args: any[]) {
      const key = resolver
        ? resolver.apply(this, args)
        : stringFromPropertyKey(propertyKey);
      const count = concurrencyPool.filter((e) => e.key === key).length;
      if (count < limit) {
        let res = fn.apply(this, args.concat({ Concurrency: { limit } }));
        if (res instanceof Promise) res.then(() => removeFromPool(key));
        else res = queuedIterator(res, () => removeFromPool(key));
        concurrencyPool.push({ key, value: res });
        return res;
      } else {
        const index = concurrencyPool.map((e) => e.key).lastIndexOf(key);
        return concurrencyPool[index].value;
      }
    };
  };
};
