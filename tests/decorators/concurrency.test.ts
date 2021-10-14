// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { Concurrency } from "../../decorators/concurrency.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.111.0/testing/asserts.ts";

class SomeClass {
  @Concurrency()
  static doSomething(arg: any) {
    return arg;
  }

  @Concurrency({
    max: 1,
    resolver: (arg: number) => {
      return `${arg}`;
    },
  })
  static doSomething1(arg: number) {
    return arg;
  }

  @Concurrency({
    max: 3,
  })
  static doSomething2(arg: number) {
    return arg;
  }
}

Deno.test({
  name: "@Concurrency()",
  async fn() {
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(SomeClass.doSomething(i));
    }
    const res = await Promise.all(promises);
    assertEquals(res, [1, 1, 1, 1, 1]);
  },
});

Deno.test({
  name: "@Concurrency({ max: 1, resolver: ... })",
  async fn() {
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(SomeClass.doSomething1(i));
    }
    const res = await Promise.all(promises);
    assertEquals(res, [1, 2, 3, 4, 5]);
  },
});

Deno.test({
  name: "@Concurrency({ max: 3 })",
  async fn() {
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(SomeClass.doSomething2(i));
    }
    const res = await Promise.all(promises);
    assertEquals(res, [1, 2, 3, 3, 3]);
  },
});
