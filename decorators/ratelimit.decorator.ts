// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { Queue } from "../utils/queue.ts";

export class RateLimitError extends Error {}

export const RateLimit = (
  { rate, limit, onRateLimited }: {
    rate: number;
    limit: number;
    onRateLimited?: () => any;
  },
) =>
  (
    _target: any,
    _property: string,
    descriptor: PropertyDescriptor,
  ) => {
    const fn = descriptor.value;
    const queue = new Queue<number>();
    const getCurrentRate = () => {
      while (queue.head !== undefined && (Date.now() - queue.head > rate)) queue.dequeue();
      return queue.length;
    };
    descriptor.value = function () {
      const rate = getCurrentRate();
      if (rate >= limit) {
        if (onRateLimited) return onRateLimited();
        else throw new RateLimitError();
      }
      queue.enqueue(Date.now());
      return fn.apply(this, [...arguments, { currentRate: rate }]);
    };
  };
