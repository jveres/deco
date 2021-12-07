// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export class TimeoutError extends Error {}

export function Timeout(
  { timeout, onTimeout }: {
    timeout: number;
    onTimeout?: (...args: any[]) => any;
  },
) {
  return function (_target: any, _property: string, descriptor: any) {
    const fn = descriptor.value;
    descriptor.value = function (...args: any[]): Promise<any> {
      let id: number;
      const abortController = new AbortController();
      return Promise.race([
        new Promise((_, reject) => {
          id = setTimeout(() => {
            clearTimeout(id);
            abortController.abort();
            reject(new TimeoutError("Timeout"));
          }, timeout);
        }),
        fn.apply(this, args),
      ]).then((result) => {
        clearTimeout(id);
        return result;
      }).catch((e: unknown) => {
        if (onTimeout && e instanceof TimeoutError) return onTimeout(args);
        else throw e;
      });
    };
  };
}
