// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export class TimeoutError extends Error {}

export const Timeout = (
  { timeout, onTimeout }: { timeout: number; onTimeout?: () => any },
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
        let id: number | undefined = undefined;
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
        ]).catch((e: unknown) => {
          if (e instanceof TimeoutError && onTimeout) return onTimeout();
          else throw e;
        })
        .finally(() => {
          if (id !== undefined) clearTimeout(id);
        });
      };
      return timeoutFn.apply(this, [fn, args, timeout]);
    };
  };
