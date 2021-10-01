// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

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
    target: Object,
    propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const originalFn = descriptor.value;
    descriptor.value = debounce(originalFn, wait, options);
  };