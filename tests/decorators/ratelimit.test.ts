// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-empty

import { RateLimit } from "../../decorators/ratelimit.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { sleep } from "../../utils/utils.ts";

let rlc: number;

class SomeClass {
  public count = 0;

  @RateLimit({
    limit: 1,
    rate: 1000,
  })
  methodTest1() {
    this.count++;
  }

  @RateLimit({
    limit: 1,
    rate: 1000,
    onRateLimited() {
      rlc++;
    },
  })
  methodTest11() {
    this.count++;
  }

  @RateLimit({ limit: 1, rate: 100 })
  async asyncMethodTest2(ms: number) {
    await sleep(ms);
    this.count++;
  }
}

Deno.test({
  name: "@RateLimit({ limit: 1, rate: 1000 })",
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
  name: "@RateLimit({ limit: 1, rate: 1000, onRateLimited() {...} })",
  sanitizeOps: false,
  async fn() {
    rlc = 0;
    const c = new SomeClass();
    for (let i = 0; i < 10; ++i) {
      c.methodTest11();
      await sleep(100);
    }
    assertEquals(rlc, 9);
    assertEquals(c.count, 1);
  },
});

Deno.test({
  name: "@RateLimit({ limit: 1, rate: 100 })",
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
