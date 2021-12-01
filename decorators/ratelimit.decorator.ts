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
): MethodDecorator =>
  (
    _target: Object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const ratelimiter = {
      fn: descriptor.value,
      queue: new Denque(),
      get rate() {
        while (
          this.queue.peekFront() &&
          (Date.now() - this.queue.peekFront() > interval)
        ) {
          this.queue.shift();
        }
        return this.queue.size() as number;
      },
    };
    descriptor.value = function (...args: any[]) {
      if (ratelimiter.rate >= limit) {
        throw new RateLimitError();
      }
      ratelimiter.queue.push(Date.now());
      return ratelimiter.fn.apply(
        this,
        args.concat({ Ratelimit: { rate: ratelimiter.rate, interval } }),
      );
    };
  };
