// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { debounce } from "../utils/utils.ts";

export const DEFAULT_DEBOUNCE_WAIT_MS = 100;

export interface DebounceOptions {
  leading?: boolean; // Specify invoking on the leading edge of the timeout
  maxWait?: number; // The maximum time func is allowed to be delayed before it's invoked
  trailing?: boolean; // Specify invoking on the trailing edge of the timeout
}

export const Debounce = (
  wait: number = DEFAULT_DEBOUNCE_WAIT_MS,
  options: DebounceOptions = { trailing: true },
): MethodDecorator =>
  (
    _target: Object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const fn = descriptor.value;
    descriptor.value = debounce(fn, wait, options);
  };
