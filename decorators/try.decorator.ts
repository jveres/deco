// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import { IsAsyncFunction } from "../utils/utils.ts";

export const Try = (
  { errors, log }: {
    errors?: string[];
    log?: boolean;
  } = {},
): MethodDecorator =>
  (
    _target: Object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const fn = descriptor.value;
    const isAsync = IsAsyncFunction(fn);
    const errorHandler = (err: unknown) => {
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
          "Runtime exception:",
          typeof err === "string" ? err : (err as Error).toString(),
        );
      }
    };
    descriptor.value = function (...args: any[]) {
      if (isAsync) {
        return fn.apply(this, args).catch((err: unknown) => {
          errorHandler(err);
        });
      } else {
        try {
          return fn.apply(this, args);
        } catch (err: unknown) {
          errorHandler(err);
        }
      }
    };
  };
