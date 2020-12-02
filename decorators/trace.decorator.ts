// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import * as Colors from "https://deno.land/std@0.79.0/fmt/colors.ts";
import string_decoder from "https://dev.jspm.io/npm:@jspm/core@1.1.1/nodelibs/string_decoder.js";

interface TraceOptions {
  stack?: boolean;
}

export function Trace(options: TraceOptions = { stack: false }) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;
    let lastFrom: string | undefined;

    descriptor.value = async function (...args: any[]) {
      const e = new Error();
      Error.captureStackTrace(e, options.stack ? undefined : descriptor.value);
      const from = options.stack
        ? "\n" + e.stack?.split("\n").slice(1).join("\n")
        : e.stack?.split("\n").slice(1)[0]?.replace("at", "").trim();
      const p1 = performance.now();
      console.log(`${
        Colors.brightMagenta(
          propertyKey +
            "(…)",
        )
      } ${Colors.bold("called")} ${options.stack ? "" : "from"} ${
        Colors.brightCyan(from ?? lastFrom ?? "unknown")
      } at ${Colors.bold(new Date().toISOString())}`);

      // TODO: bundler does not support this, report as swc bug
      // lastFrom ??= from;
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
      } at ${Colors.bold(new Date().toISOString())}`);
      return result;
    };
    return descriptor;
  };
}