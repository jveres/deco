// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import * as Colors from "https://deno.land/std@0.115.0/fmt/colors.ts";

interface TryOptions {
  catch?: string[];
  log?: boolean;
  onError?: (e: any) => void;
  onDone?: () => void;
}

export const Try = (options?: TryOptions): MethodDecorator =>
  (
    _target: Object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const originalFn = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalFn.apply(this, args);
      } catch (e: unknown) {
        if (options?.catch) {
          if (
            (e instanceof Error &&
              !options.catch.includes(e.constructor.name)) ||
            (typeof e === "string" && !options.catch.includes(e))
          ) {
            throw e;
          }
        }
        if (options?.log) {
          console.error(
            Colors.brightRed("Runtime exception:"),
            Colors.brightYellow(
              typeof e === "string" ? e : (e as Error).message,
            ),
          );
        }
        options?.onError?.(e);
      } finally {
        options?.onDone?.();
      }
    };
  };
