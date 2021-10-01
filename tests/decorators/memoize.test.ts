// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { assertEquals } from "https://deno.land/std@0.109.0/testing/asserts.ts";

import { Memoize } from "../../decorators/memoize.decorator.ts";
import { sleep } from "../../utils/utils.ts";

class SomeClass {
  #i = 0;

  @Memoize()
  doSomething1() {
    return ++this.#i;
  }

  @Memoize({
    ttl: 100,
    resolver: (): string => {
      return "key";
    },
  })
  doSomething2() {
    return ++this.#i;
  }
}

Deno.test({
  name: "@Memoize() with default options",
  async fn(): Promise<void> {
    const c = new SomeClass();
    const i1 = await c.doSomething1();
    assertEquals(i1, 1);
    const i2 = await c.doSomething1();
    assertEquals(i2, 1);
  },
});

Deno.test({
  name: "@Memoize() with ttl and resolver",
  async fn(): Promise<void> {
    const c = new SomeClass();
    const i1 = await c.doSomething2();
    assertEquals(i1, 1);
    await sleep(300);
    const i2 = await c.doSomething2();
    assertEquals(i2, 2);
  },
});
