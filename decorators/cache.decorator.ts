// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { LruCache } from "../utils/utils.ts";

export const Cache = ({ resolver, ttl }: {
  resolver?: (...args: any[]) => string;
  ttl?: number;
} = {}) =>
  (
    _target: any,
    _property: string,
    descriptor: PropertyDescriptor,
  ) => {
    const fn = descriptor.value;
    const cache = new LruCache<any>();
    let timeout = Number.POSITIVE_INFINITY;
    descriptor.value = function (...args: any[]) {
      const key = resolver?.apply(this, args) ?? JSON.stringify(args);
      if (cache.has(key) && (!ttl || timeout > Date.now())) {
        const value: any = cache.get(key);
        return Promise.resolve(value);
      } else {
        if (ttl) timeout = Date.now() + ttl;
        return Promise.resolve(fn.apply(this, args)).then((result: any) => {
          cache.put(key, result);
          return result;
        });
      }
    };
  };
