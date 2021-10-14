// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

export const Metadata = (key: string, value: any): ClassDecorator =>
  (target: Function): void => {
    Reflect.defineProperty(target, key, { value });
  };
