// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types

export const hasMetadata = (target: object, key: string) => Reflect.has(target, key);

export function getMetadata<T>(target: object, key: string): T | undefined;
export function getMetadata<T>(target: object, key: string, defaultValue: T): T;
export function getMetadata<T>(target: object, key: string, defaultValue?: unknown)
 {
  if (!hasMetadata(target, key)) {
    if (defaultValue !== undefined) {
      setMetadata(target, key, defaultValue);
      return defaultValue;
    } else {
      return undefined;
    }
  }
  return Reflect.get(target, key) as T;
}

export const setMetadata = (target: object, key: string, value: unknown) => {
  return Reflect.defineProperty(target, key, { value });
};

export const Metadata = (key: string, value: unknown): ClassDecorator =>
  (target: Function): void => {
    setMetadata(target, key, value);
  };
