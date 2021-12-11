// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export class TimeoutError extends Error {}

export function pTimeout(
  { promise, timeout, onTimeout }: {
    promise: Promise<any>;
    timeout: number;
    onTimeout?: () => any;
  },
): Promise<any> {
  let id: number;
  return Promise.race([
    new Promise((_, reject) => {
      id = setTimeout(() => {
        clearTimeout(id);
        reject(new TimeoutError());
      }, timeout);
    }),
    promise,
  ]).then((result) => {
    clearTimeout(id);
    return result;
  }).catch((e: unknown) => {
    if (onTimeout && e instanceof TimeoutError) return onTimeout();
    else throw e;
  });
}

export function Timeout(
  { timeout, onTimeout }: {
    timeout: number;
    onTimeout?: () => any;
  },
) {
  return function (_target: any, _property: string, descriptor: any) {
    const fn = descriptor.value;
    descriptor.value = function (...args: any[]): Promise<any> {
      const abortController = new AbortController();
      return pTimeout({
        promise: fn.apply(this, args.concat({ abortController })),
        timeout,
        onTimeout: () => {
          abortController.abort();
          return onTimeout?.();
        },
      });
    };
  };
}
