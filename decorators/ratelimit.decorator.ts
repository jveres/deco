// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { Denque } from "../utils/utils.ts";

export class RateLimitError extends Error {}

const DEFAULT_RATE = 1;
const DEFAULT_INTERVAL = 1000;

export const RateLimit = (
  { limit = DEFAULT_RATE, interval = DEFAULT_INTERVAL }: {
    limit?: number;
    interval?: number;
  } = {},
) => {
  return function <T extends (...args: any[]) => any>(
    _target: Object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const fn = descriptor.value!;
    const queue = new Denque();
    const getRate = () => {
      while (
        queue.peekFront() &&
        (Date.now() - queue.peekFront() > interval)
      ) {
        queue.shift();
      }
      return queue.size() as number;
    };
    descriptor.value = <T> function (this: unknown, ...args: any[]) {
      const rate = getRate();
      if (rate >= limit) {
        throw new RateLimitError();
      }
      queue.push(Date.now());
      return fn.apply(this, args.concat({ Ratelimit: { rate, interval } }));
    };
  };
};
