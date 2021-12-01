// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import { stringFromPropertyKey } from "../utils/utils.ts";

type ConcurrencyPoolItem = {
  key: string;
  value: Promise<any> | AsyncGenerator<any>;
};

export const Concurrency = ({ limit = 1, resolver }: {
  limit?: number;
  resolver?: (...args: any[]) => string;
} = {}) => {
  return function <
    T extends (...args: any[]) => Promise<any>,
  >(
    _target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const fn = descriptor.value!;
    const concurrencyPool: ConcurrencyPoolItem[] = [];
    const removeFromPool = (key: string) => {
      const index = concurrencyPool.findIndex((item) => item.key === key);
      if (index > -1) concurrencyPool.splice(index, 1);
    };
    descriptor.value = <T> function (this: unknown, ...args: any[]) {
      const key = resolver
        ? resolver.apply(this, args)
        : stringFromPropertyKey(propertyKey);
      const count = concurrencyPool.filter((e) => e.key === key).length;
      if (count < limit) {
        const res = fn.apply(this, args.concat({ Concurrency: { limit } }));
        res.then(() => removeFromPool(key));
        concurrencyPool.push({ key, value: res });
        return res;
      } else {
        const index = concurrencyPool.map((e) => e.key).lastIndexOf(key);
        return concurrencyPool[index].value;
      }
    };
  };
};
