// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import { Fn, stringFromPropertyKey } from "../utils/utils.ts";

type ConcurrencyPoolItem = {
  key: string;
  promise: Promise<any>;
};

type ConcurrencyDecorator = {
  (
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<Fn<Promise<any>>>,
  ): TypedPropertyDescriptor<Fn<Promise<any>>>;
};

export const Concurrency = ({ limit = 1, resolver }: {
  limit?: number;
  resolver?: Fn<string>;
} = {}): ConcurrencyDecorator => {
  return (
    _target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<Fn<Promise<any>>>,
  ) => {
    const fn = descriptor.value!;
    const concurrencyPool: ConcurrencyPoolItem[] = [];
    descriptor.value = function (...args: any[]) {
      const key = resolver
        ? resolver.apply(this, args)
        : stringFromPropertyKey(propertyKey);
      const count = concurrencyPool.filter((e) => e.key === key).length;
      if (count < limit) {
        args.push({ concurrency: { limit } });
        const promise = fn.apply(this, args);
        promise.then((res: any) => {
          const index = concurrencyPool.findIndex((item) => item.key === key);
          if (index > -1) concurrencyPool.splice(index, 1);
          return res;
        });
        concurrencyPool.push({ key, promise });
        return promise;
      } else {
        const index = concurrencyPool.map((e) => e.key).lastIndexOf(key);
        const { promise } = concurrencyPool[index];
        return promise;
      }
    };
    return descriptor;
  };
};
