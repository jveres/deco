// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

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
    const queue: number[] = [];
    const getCurrentRate = () => {
      while (queue[0] && (Date.now() - queue[0] > rate)) queue.shift();
      return queue.length;
    };
    descriptor.value = function (...args: any[]) {
      const rate = getCurrentRate();
      if (rate >= limit) {
        if (onRateLimited) return onRateLimited();
        else throw new RateLimitError();
      }
      queue.push(Date.now());
      return fn.apply(this, [{ currentRate: rate }, ...args]);
    };
  };
