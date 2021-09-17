// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { debounce } from "../utils.ts";

export const DEFAULT_WAIT_MS = 100;

export interface DebounceOptions {
  leading?: boolean; // Specify invoking on the leading edge of the timeout
  maxWait?: number; // The maximum time func is allowed to be delayed before it's invoked
  trailing?: boolean; // Specify invoking on the trailing edge of the timeout
}

export function Debounce(
  wait: number = DEFAULT_WAIT_MS,
  options: DebounceOptions = {},
) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;
    descriptor.value = debounce(originalFn, wait, options);
    return descriptor;
  };
}
