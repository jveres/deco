// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import { Denque } from "../utils/utils.ts";

export class RateLimitError extends Error {}

export interface RateLimitOptions {
  interval?: number;
  rate?: number;
}

const DEFAULT_RATE_LIMIT = 1;
const DEFAULT_RATE_INTERVAL_MS = 1000;

export const RateLimit = (options?: RateLimitOptions): MethodDecorator =>
  (
    _target: Object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const originalFn = descriptor.value;
    const queue = new Denque();

    const getCurrentRate = (): number => {
      while (
        queue.peekFront() &&
        (Date.now() - queue.peekFront() >
          (options?.interval ?? DEFAULT_RATE_INTERVAL_MS))
      ) {
        queue.shift();
      }
      return queue.size();
    };

    descriptor.value = async function (...args: any[]) {
      if (getCurrentRate() >= (options?.rate ?? DEFAULT_RATE_LIMIT)) {
        throw new RateLimitError("Rate limit exceeded");
      }
      queue.push(Date.now());
      return await originalFn.apply(
        this,
        args.concat([{ options, getCurrentRate }]),
      );
    };
  };
