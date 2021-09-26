// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import * as Colors from "https://deno.land/std@0.107.0/fmt/colors.ts";

interface TryOptions {
  catch?: string[];
  log?: boolean;
  onError?: (e: any) => void;
  onDone?: () => void;
}

export const Try = (options?: TryOptions): MethodDecorator =>
  (
    target: Object,
    propertyKey: string | Symbol,
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
        if (options?.onError) options.onError(e);
      } finally {
        if (options?.onDone) options.onDone();
      }
    };
  };
