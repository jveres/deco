// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import { stringFromPropertyKey } from "../utils/utils.ts";

export const DEFAULT_TIMEOUT_MS = 10000;
export class TimeoutError extends Error {}

export const Timeout = (
  timeout: number = DEFAULT_TIMEOUT_MS,
) =>
  (
    _target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>,
  ) => {
    const fn = descriptor.value!;
    descriptor.value = async function (...args: any[]) {
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
              reject(new TimeoutError());
            }, timeout);
          }),
          fn.apply(
            this,
            args.concat([{ Timeout: { timeout, abortController } }]),
          ),
        ]).then((result) => {
          clearTimeout(id);
          return result;
        });
      };
      try {
        return await timeoutFn.apply(this, [fn, args, timeout]);
      } catch (e: unknown) {
        if (e instanceof TimeoutError) {
          e.message = `${
            stringFromPropertyKey(propertyKey)
          }() exception, timed out after ${timeout}ms`;
          Error.captureStackTrace(e, descriptor.value);
        }
        throw e;
      }
    };
  };
