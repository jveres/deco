// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { assertEquals } from "https://deno.land/std@0.127.0/testing/asserts.ts";

import { Cache } from "../../decorators/cache.decorator.ts";
import { sleep } from "../../utils/utils.ts";

class SomeClass {
  #i = 0;

  @Cache()
  doSomething1() {
    return ++this.#i;
  }

  @Cache({
    ttl: 100,
    resolver: (): string => {
      return "key";
    },
  })
  doSomething2() {
    return ++this.#i;
  }

  @Cache({
    resolver: (): string => {
      return "key";
    },
  })
  doSomething3(n: number) {
    return n;
  }

  @Cache()
  doPromise1(n: number) {
    return Promise.resolve(n);
  }

  @Cache({
    resolver: (): string => {
      return "key";
    },
  })
  doPromise2(n: number) {
    return Promise.resolve(n);
  }

  @Cache({
    resolver: (): string => {
      return "key";
    },
    ttl: 100,
  })
  doPromise3(n: number) {
    return Promise.resolve(n);
  }
}

Deno.test({
  name: "@Cache() with defaults",
  async fn() {
    const c = new SomeClass();
    const i1 = await c.doSomething1();
    assertEquals(i1, 1);
    const i2 = await c.doSomething1();
    assertEquals(i2, 1);
  },
});

Deno.test({
  name: "@Cache() with ttl and resolver",
  async fn() {
    const c = new SomeClass();
    const i1 = await c.doSomething2();
    assertEquals(i1, 1);
    await sleep(300);
    const i2 = await c.doSomething2();
    assertEquals(i2, 2);
  },
});

Deno.test({
  name: "@Cache() with resolver",
  async fn() {
    const c = new SomeClass();
    const nums = [1, 2, 3, 4, 5];
    const res = [];
    for (let i = 0; i < nums.length; i++) {
      res.push(await c.doSomething3(nums[i]));
    }
    assertEquals(res, Array(nums.length).fill(1));
  },
});

Deno.test({
  name: "@Cache() with Promise, function signature as key",
  async fn() {
    const c = new SomeClass();
    const nums = [1, 2, 3, 4, 5];
    const res = [];
    for (let i = 0; i < nums.length; i++) {
      res.push(await c.doPromise1(nums[i]));
    }
    assertEquals(res, nums);
  },
});

Deno.test({
  name: "@Cache() with Promise, custom resolver",
  async fn() {
    const c = new SomeClass();
    const nums = [1, 2, 3, 4, 5];
    const res = [];
    for (let i = 0; i < nums.length; i++) {
      res.push(await c.doPromise2(nums[i]));
    }
    assertEquals(res, Array(nums.length).fill(1));
  },
});

Deno.test({
  name: "@Cache() with Promise, custom resolver, ttl=100ms",
  async fn() {
    const c = new SomeClass();
    const nums = [1, 2, 3, 4, 5];
    const res = [];
    for (let i = 0; i < nums.length; i++) {
      res.push(await c.doPromise3(nums[i]));
      await sleep(100);
    }
    assertEquals(res, nums);
  },
});
