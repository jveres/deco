// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export const Concurrency = ({ limit = 1, resolver }: {
  limit?: number;
  resolver?: (...args: any[]) => string;
} = {}) => {
  return function (
    _target: any,
    property: string,
    descriptor: PropertyDescriptor,
  ) {
    const concurrencyPool = new Map<string, Promise<any>[]>();
    const fn = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const key = resolver ? resolver.apply(this, args) : property;
      const count = concurrencyPool.get(key)?.length || 0;
      if (count < limit) {
        const promise = Promise.resolve(fn.apply(this, args));
        if (!concurrencyPool.has(key)) concurrencyPool.set(key, [promise]);
        else concurrencyPool.get(key)!.push(promise);
        promise.then(() => concurrencyPool.delete(key));
        return promise;
      } else {
        return Promise.any(concurrencyPool.get(key)!);
      }
    };
  };
};
