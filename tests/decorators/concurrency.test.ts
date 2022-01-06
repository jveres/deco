// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { Concurrency } from "../../decorators/concurrency.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";

class SomeClass {
  @Concurrency()
  static doSomething(p: number) {
    return p;
  }

  @Concurrency({
    resolver: (n: number) => {
      return `${n}`;
    },
  })
  static doSomething1(n: number, idx?: number) {
    if (idx !== undefined) return Promise.resolve({ n, idx });
    else return Promise.resolve(n);
  }

  @Concurrency({
    limit: 3,
  })
  static doSomething2(n: number) {
    return Promise.resolve(n);
  }
}

Deno.test({
  name: "@Concurrency() with defaults",
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
  name: "@Concurrency({ limit: 1 }) with resolver, unique keys",
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
  name: "@Concurrency({ limit: 1 }) with resolver, reused keys",
  async fn() {
    const promises: Promise<any>[] = [];
    const nums = [1, 2, 2, 1, 3, 1, 1, 3, 4];
    for (let i = 0; i < nums.length; i++) {
      promises.push(SomeClass.doSomething1(nums[i], i));
    }
    const res = await Promise.all(promises);
    const indexes = res.map((n) => n["idx"]);
    assertEquals(indexes, [0, 1, 1, 0, 4, 0, 0, 4, 8]);
  },
});

Deno.test({
  name: "@Concurrency({ limit: 3 })",
  async fn() {
    const promises = [];
    for (let i = 1; i <= 6; i++) {
      promises.push(SomeClass.doSomething2(i));
    }
    const res = await Promise.all(promises);
    assertEquals(res, [1, 2, 3, 1, 1, 1]);
  },
});
