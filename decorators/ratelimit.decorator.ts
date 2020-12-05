// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { Denque } from "../utils.ts";

export class RateLimitError extends Error {}

export interface RateLimitOptions {
  interval?: number;
  rate?: number;
}

export function RateLimit(options?: RateLimitOptions) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;
    const queue = new Denque();

    descriptor.value = async function (...args: any[]) {
      const now = Date.now();
      while (
        queue.peekFront() &&
        (Date.now() - queue.peekFront() > (options?.interval ?? 1000))
      ) {
        queue.shift();
      }
      if (queue.size() >= (options?.rate ?? 1)) {
        throw new RateLimitError("Rate limit exceeded");
      }
      let result = undefined;
      queue.push(Date.now());
      return await originalFn.apply(this, args);
    };

    return descriptor;
  };
}
