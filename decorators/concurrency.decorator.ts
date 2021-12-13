// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

interface ConcurrencyPoolItem {
  key: string;
  value: Promise<any>;
}

export const Concurrency = ({ limit = 1, resolver }: {
  limit?: number;
  resolver?: (...args: any[]) => string;
} = {}) => {
  return function (
    _target: any,
    property: string,
    descriptor: PropertyDescriptor,
  ) {
    const concurrencyPool: ConcurrencyPoolItem[] = [];
    const removeFromPool = (key: string) => {
      const index = concurrencyPool.findIndex((item) => item.key === key);
      if (index > -1) concurrencyPool.splice(index, 1);
    };
    const fn = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const key = resolver ? resolver.apply(this, args) : property;
      const count = concurrencyPool.filter((e) => e.key === key).length;
      if (count < limit) {
        const res = Promise.resolve(fn.apply(this, args));
        concurrencyPool.push({ key, value: res });
        res.then(() => removeFromPool(key));
        return res;
      } else {
        const index = concurrencyPool.map((e) => e.key).lastIndexOf(key);
        return concurrencyPool[index].value;
      }
    };
  };
};
