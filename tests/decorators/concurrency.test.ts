// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file require-await

import { Concurrency } from "../../decorators/concurrency.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.115.1/testing/asserts.ts";

class SomeClass {
  @Concurrency()
  static async doSomething(p: number) {
    return p;
  }

  @Concurrency({
    limit: 1,
    resolver: (n: number) => {
      return `${n}`;
    },
  })
  static async doSomething1(n: number) {
    return n;
  }

  @Concurrency({
    limit: 3,
  })
  static async doSomething2(n: number) {
    return n;
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
  name: "@Concurrency() with resolver 1",
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
  name: "@Concurrency() with resolver 2",
  async fn() {
    const promises: Promise<number>[] = [];
    const nums = [1, 2, 2, 1, 3, 1, 1, 3, 4];
    for (let i = 0; i < nums.length; i++) {
      promises.push(SomeClass.doSomething1(nums[i] + 1));
    }
    await Promise.all(promises);
    const distincts = promises.filter((n, i) => promises.indexOf(n) === i);
    assertEquals(distincts, [promises[0], promises[1], promises[4], promises[8]]);
  },
});

Deno.test({
  name: "@Concurrency({ limit: 3 })",
  async fn() {
    const promises = [];
    for (let i = 1; i <= 5; i++) {
      promises.push(SomeClass.doSomething2(i));
    }
    const res = await Promise.all(promises);
    assertEquals(res, [1, 2, 3, 3, 3]);
  },
});
