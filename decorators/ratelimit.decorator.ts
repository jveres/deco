// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { rateLimit, RateLimitError } from "../utils.ts";

export interface RateLimitOptions {
  rps: number;
  interval?: number;
  rate?: number;
  concurrency?: number;
  maxDelay?: number;
}

export function RateLimit(options: RateLimitOptions = { rps: 1 }) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;
    const limit = rateLimit({
      interval: options.interval ?? 1000,
      rate: options.rate ?? options.rps,
      concurrency: options.concurrency ?? 10,
      maxDelay: options.maxDelay ?? 1,
    });

    descriptor.value = async function (...args: any[]) {
      return await limit(originalFn.bind(this, args));
    };

    return descriptor;
  };
}
