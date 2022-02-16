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
    const origFn = descriptor.value;
    descriptor.value = function (...args: any[]) {
      let id: number | undefined;
      const abortController = new AbortController();
      args.push({ timeoutSignal: abortController.signal });
      return Promise.race([
        new Promise((_, reject) => {
          id = setTimeout(() => {
            clearTimeout(id);
            abortController.abort();
            reject(new TimeoutError());
          }, timeout);
        }),
        origFn.apply(this, [args]),
      ]).catch((e: unknown) => {
        if (e instanceof TimeoutError && onTimeout) return onTimeout();
        else throw e;
      })
        .finally(() => {
          if (id !== undefined) clearTimeout(id);
        });
    };
  };
