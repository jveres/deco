// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { throttle } from "../utils/utils.ts";

export const DEFAULT_THROTTLE_WAIT_MS = 100;

export const Throttle = (
  wait: number = DEFAULT_THROTTLE_WAIT_MS,
): MethodDecorator =>
  (
    _target: Object,
    _propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    const originalFn = descriptor.value;
    descriptor.value = throttle(originalFn, wait, { "trailing": false });
  };
