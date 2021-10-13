// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import * as Colors from "https://deno.land/std@0.111.0/fmt/colors.ts";

export const DEFAULT_TIMEOUT_MS = 10000;

export const Timeout = (
  timeout: number = DEFAULT_TIMEOUT_MS,
): MethodDecorator =>
  (
    target: Object,
    propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const originalFn = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      // Timeout wrapper function
      const timeoutAsync = (
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
              reject(new Error("timeout"));
            }, timeout);
          }),
          fn.apply(this, args.concat([{ timeout, abortController }])),
        ]).then((result) => {
          clearTimeout(id);
          return result;
        });
      };

      try {
        return await timeoutAsync.apply(
          this,
          [
            originalFn,
            args,
            timeout,
          ],
        );
      } catch (e) {
        if (e.message === "timeout") {
          e.message = `${
            Colors.bold("Timeout (" + String(timeout) + "ms")
          }) exceeded for ${
            Colors.brightMagenta(
              propertyKey +
                "(…)",
            )
          }`;
          Error.captureStackTrace(e, descriptor.value);
        }
        throw e;
      }
    };
  };
