// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { LruCache } from "../utils/utils.ts";

interface MemoizeOptions {
  resolver?: (...args: any[]) => string;
  ttl?: number;
  onAdded?: (key: string, value: any) => void;
  onFound?: (key: string, value: any) => void;
}

export const Memoize = (options?: MemoizeOptions): MethodDecorator =>
  (
    target: Object,
    propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const originalFn = descriptor.value;
    const cache = new LruCache<any>();
    let timeout = Number.POSITIVE_INFINITY;

    descriptor.value = async function (...args: any[]) {
      const key = options?.resolver?.(args) ?? JSON.stringify(args);

      if (cache.has(key) && (!options?.ttl || timeout > Date.now())) {
        const value: any = cache.get(key);
        options?.onFound?.(key, value);
        return value;
      } else {
        const result = await originalFn.apply(this, args);
        cache.put(key, result);
        options?.onAdded?.(key, result);
        if (options?.ttl) timeout = Date.now() + options.ttl;
        return result;
      }
    };
  };
