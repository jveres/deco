// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

export function Try() {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalFn.apply(this, args);
      } catch {}
    };

    return descriptor;
  };
}
