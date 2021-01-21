// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

interface ConcurrencyOptions {
  max: number;
  resolver?: (...args: any[]) => string;
}

interface PoolItem {
  key: string;
  promise: Promise<unknown>;
}

export function Concurrency(options: ConcurrencyOptions = { max: 1 }) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;
    const pool: PoolItem[] = [];

    descriptor.value = async function (...args: any[]) {
      const key = options.resolver
        ? options.resolver.apply(this, args)
        : propertyKey;
      const count = pool.filter((e) => e.key === key).length;
      if (count < options.max) {
        const promise = originalFn.apply(this, args);
        const result = promise.then((res: any) => {
          const index = pool.findIndex((e) => e.key === key);
          if (index > -1) pool.splice(index, 1);
          return res;
        });
        pool.push({ key, promise });
        return await result;
      } else {
        const index = pool.map((e) => e.key).lastIndexOf(key);
        const promise = pool[index].promise;
        return promise;
      }
    };

    return descriptor;
  };
}
