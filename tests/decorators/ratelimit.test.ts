// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-empty

import { RateLimit } from "../../decorators/ratelimit.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.116.0/testing/asserts.ts";
import { sleep } from "../../utils/utils.ts";

class SomeClass {
  public count = 0;

  @RateLimit()
  methodTest1() {
    this.count++;
  }

  @RateLimit({ limit: 1, interval: 100 })
  async asyncMethodTest2(ms: number) {
    await sleep(ms);
    this.count++;
  }
}

Deno.test({
  name: "@RateLimit() with defaults",
  sanitizeOps: false,
  async fn() {
    const c = new SomeClass();
    for (let i = 0; i < 10; ++i) {
      try {
        c.methodTest1();
        await sleep(100);
      } catch {}
    }
    assertEquals(c.count, 1);
  },
});

Deno.test({
  name: "@RateLimit({ limit: 1, interval: 100 })",
  sanitizeOps: false,
  async fn() {
    const c = new SomeClass();
    for (let i = 0; i < 10; ++i) {
      try {
        await c.asyncMethodTest2(150);
      } catch {}
    }
    assertEquals(c.count, 10);
  },
});
