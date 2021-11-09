// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { RateLimit } from "../../decorators/ratelimit.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.114.0/testing/asserts.ts";
import { sleep } from "../../utils/utils.ts";

class SomeClass {
  public count = 0;

  @RateLimit()
  async asyncMethodTest1(ms: number) {
    await sleep(ms);
    this.count++;
  }

  @RateLimit({ rate: 1, interval: 1000 })
  async asyncMethodTest2(ms: number) {
    await sleep(ms);
    this.count++;
  }
}

Deno.test({
  name: "@RateLimit with defaults",
  sanitizeOps: false,
  async fn() {
    const c = new SomeClass();
    for (let i = 0; i < 10; ++i) {
      try {
        await c.asyncMethodTest1(100);
      } catch {() => {}}
    }
    assertEquals(c.count, 1);
  },
});

Deno.test({
  name: "@RateLimit with { rate: 1, interval: 1000 }",
  sanitizeOps: false,
  async fn() {
    const c = new SomeClass();
    for (let i = 0; i < 2; ++i) {
      try {
        await c.asyncMethodTest2(100);
      } catch {() => {}}
    }
    assertEquals(c.count, 1);
  },
});
