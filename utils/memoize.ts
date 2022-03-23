/**
 * Copyright 2022 Janos Veres. All rights reserved.
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file.
 */

import { LruCache } from "../utils/lrucache.ts";

const cache = new LruCache<{ timeout: number; value: unknown }>();

export function memoize<T>(fn: () => Promise<T>, options: {
  ttl?: number;
  key: () => string;
  get?: (value: T) => T;
  set?: (value: T) => T;
}) {
  return new Promise<T>((resolve) => {
    const key = options.key();
    const cached = cache.get(key);
    if (cached !== undefined && (!options.ttl || cached.timeout > Date.now())) {
      const value = cached.value as T;
      resolve(options.get ? options.get(value) : value);
    } else {
      const timeout = options.ttl
        ? Date.now() + options.ttl
        : Number.POSITIVE_INFINITY;
      fn().then((result) => {
        const value = options.set ? options.set(result) : result;
        cache.put(key, { timeout, value });
        resolve(result);
      });
    }
  });
}
