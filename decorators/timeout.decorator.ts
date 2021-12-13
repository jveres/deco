// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export const DEFAULT_TIMEOUT_MS = 10000;
export class TimeoutError extends Error {}

export const Timeout = (
  timeout: number = DEFAULT_TIMEOUT_MS,
) =>
  (
    _target: any,
    _property: string,
    descriptor: PropertyDescriptor,
  ) => {
    const fn = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const timeoutFn = (
        fn: (...args: any[]) => any,
        args: any[],
        timeout: number,
      ) => {
        let id: number;
        const abortController = new AbortController();
        return Promise.race([
          new Promise((_, reject) => {
            id = setTimeout(() => {
              clearTimeout(id);
              abortController.abort();
              reject(new TimeoutError("Timed out"));
            }, timeout);
          }),
          fn.apply(this, args.concat([{ abortController }])),
        ]).finally(() => {
          clearTimeout(id);
        });
      };
      return timeoutFn.apply(this, [fn, args, timeout]);
    };
  };
