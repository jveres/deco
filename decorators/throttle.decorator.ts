// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { throttle } from "../utils.ts";

export const DEFAULT_THROTTLE_WAIT_MS = 100;

export interface ThrottleOptions {
  leading?: boolean; // Specify invoking on the leading edge of the timeout
  trailing?: boolean; // Specify invoking on the trailing edge of the timeout
}

export function Throttle(
  wait: number = DEFAULT_THROTTLE_WAIT_MS,
  options: ThrottleOptions = { leading: true, trailing: true },
) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;
    descriptor.value = throttle(originalFn, wait, { "trailing": false });
    return descriptor;
  };
}
