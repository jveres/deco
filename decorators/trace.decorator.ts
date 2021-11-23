// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import { IsAsyncFunction, stringFromPropertyKey } from "../utils/utils.ts";

export const Trace = (
  { stack = false }: { stack?: boolean } = {},
): MethodDecorator =>
  (
    _target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const fn = descriptor.value;
    const logDurationSince = (time: number) => {
      console.log(
        `${stringFromPropertyKey(propertyKey)}() finished in ${
          (performance.now() - time).toFixed()
        } ms`,
      );
    };
    let lastFrom: string | undefined;

    descriptor.value = function (...args: any[]) {
      const e = new Error();
      Error.captureStackTrace(e, stack ? undefined : descriptor.value);
      const from = stack
        ? "\n" + e.stack?.split("\n").slice(1).join("\n")
        : e.stack?.split("\n").slice(1)[0]?.replace("at", "").trim();
      const start = performance.now();
      console.log(
        `${stringFromPropertyKey(propertyKey)}() called ${
          stack ? "" : "from"
        } ${from ?? lastFrom ?? "n/a"}`,
      );
      if (from) lastFrom = from;
      if (IsAsyncFunction(fn)) {
        return fn.apply(this, args).then((result: any) => {
          logDurationSince(start);
          return result;
        });
      } else {
        const result = fn.apply(this, args);
        logDurationSince(start);
        return result;
      }
    };
  };
