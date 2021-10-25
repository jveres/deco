// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import * as Colors from "https://deno.land/std@0.113.0/fmt/colors.ts";

interface TraceOptions {
  stack?: boolean;
}

export const Trace = (
  options: TraceOptions = { stack: false },
): MethodDecorator =>
  (
    _target: Object,
    propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const originalFn = descriptor.value;
    let lastFrom: string | undefined;

    descriptor.value = async function (...args: any[]) {
      const e = new Error();
      Error.captureStackTrace(e, options.stack ? undefined : descriptor.value);
      const from = options.stack
        ? "\n" + e.stack?.split("\n").slice(1).join("\n")
        : e.stack?.split("\n").slice(1)[0]?.replace("at", "").trim();
      const p1 = performance.now();
      console.log(
        `${Colors.brightMagenta(propertyKey + "(…)")} ${
          Colors.bold("called")
        } ${options.stack ? "" : "from"} ${
          Colors.brightCyan(from ?? lastFrom ?? "unknown")
        }`,
      );

      if (from) lastFrom = from;

      let result;
      originalFn.constructor.name === "AsyncFunction"
        ? result = await originalFn.apply(this, args)
        : result = originalFn.apply(this, args);
      console.log(`${
        Colors.brightMagenta(
          propertyKey +
            "(…)",
        )
      } ${Colors.green("ended")} in ${
        Colors.brightYellow((performance.now() - p1).toFixed() + "ms")
      }`);
      return result;
    };
  };
