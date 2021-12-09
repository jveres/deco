// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

interface ConcurrencyPoolItem {
  key: string;
  value: Promise<any>;
}

const concurrencyPool: ConcurrencyPoolItem[] = [];

function removeFromPool(key: string) {
  const index = concurrencyPool.findIndex((item) => item.key === key);
  if (index > -1) concurrencyPool.splice(index, 1);
}

export function pConcurrency(
  { promiseFn, limit, resolver }: {
    promiseFn: () => Promise<any>;
    limit: number;
    resolver?: () => string;
  },
): Promise<any> {
  return new Promise((resolve, _) => {
    const key = resolver?.() || crypto.randomUUID();
    const count = concurrencyPool.filter((e) => e.key === key).length;
    console.log(key, count);
    if (count < limit) {
      const res = promiseFn();
      concurrencyPool.push({ key, value: res });
      Promise.resolve(res).then(resolve).finally(() => removeFromPool(key));
    } else {
      const index = concurrencyPool.map((e) => e.key).lastIndexOf(key);
      resolve(concurrencyPool[index].value);
    }
  });
}

export function Concurrency(
  { limit, resolver }: { limit: number; resolver?: () => string },
) {
  return function (_target: any, _property: string, descriptor: any) {
    const fn = descriptor.value;
    descriptor.value = function (...args: any[]): Promise<any> {
      return pConcurrency({
        promiseFn: fn.bind(this, args),
        limit,
        ...resolver && { resolver: resolver.bind(this, args) },
      });
    };
  };
}
