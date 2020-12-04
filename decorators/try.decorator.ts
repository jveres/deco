// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

interface TryOptions {
  catch?: string[];
  onError?: (e: any) => void;
  onDone?: () => void;
}

export function Try(options?: TryOptions) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalFn.apply(this, args);
      } catch (e: unknown) {
        if (e instanceof Error && options?.catch && !options.catch.includes(e.constructor.name)) throw e;
        if (typeof e === "string" && options?.catch && !options.catch.includes(e)) throw e;
        else if (options?.onError) options.onError(e);
      } finally {
        if (options?.onDone) options.onDone();
      }
    };

    return descriptor;
  };
}
