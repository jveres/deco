// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export const Try = (
  { errors, log }: {
    errors?: string[];
    log?: boolean;
  } = {},
) =>
  (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): void => {
    const origFn = descriptor.value;
    const handler = (err: unknown) => {
      if (errors) {
        if (
          (err instanceof Error && !errors.includes(err.name)) ||
          (typeof err === "string" && !errors.includes(err))
        ) {
          throw err;
        }
      }
      if (log) {
        console.error(
          typeof err === "string" ? err : (err as Error).toString(),
        );
      }
    };
    descriptor.value = async function (...args: any[]) {
      try {
        await origFn.apply(this, args);
      } catch (err: unknown) {
        handler(err);
      }
    };
  };
