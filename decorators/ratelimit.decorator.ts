// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { DEFAULT_QUOTA, Quota, rateLimit } from "../utils.ts";

export function RateLimit(options: Quota = DEFAULT_QUOTA) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;
    const limit = rateLimit(options);

    descriptor.value = async function (...args: any[]) {
      return await limit(originalFn.bind(this, args));
    };

    return descriptor;
  };
}
