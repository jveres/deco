// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export const Trace = (
  { stack = false }: { stack?: boolean } = {},
) =>
  (
    _target: any,
    property: string,
    descriptor: PropertyDescriptor,
  ): void => {
    const fn = descriptor.value;
    const logDurationSince = (time: number) => {
      console.info(
        `${property}() ...ended, took: ${
          (performance.now() - time).toFixed()
        }ms`,
      );
    };
    let lastFrom: string | undefined;
    descriptor.value = function () {
      const e = new Error();
      Error.captureStackTrace(e, stack ? undefined : descriptor.value);
      const from = stack ? "\n" + e.stack?.split("\n").slice(1).join("\n")
      : e.stack?.split("\n").slice(1)[0]?.replace("at", "").trim();
      const start = performance.now();
      console.info(
        `${property}() started... ${
          (stack && (from || lastFrom))
            ? "(" + (from || lastFrom || "n/a") + "\n)"
            : ""
        }`,
      );
      if (from) lastFrom = from;
      return Promise.resolve(fn.apply(this, [...arguments])).finally(() => {
        logDurationSince(start);
      });
    };
  };
