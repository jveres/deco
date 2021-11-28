// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file require-await

import {
  DEFAULT_MAX_ATTEMPTS,
  Retry,
} from "../../decorators/retry.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.116.0/testing/asserts.ts";

class SomeClass {
  public i = 0;

  @Retry()
  async retryDefault() {
    ++this.i;
    throw new Error(`tried ${this.i} times`);
  }

  @Retry({ maxAttempts: 3 })
  async retryWithMaxAttempts() {
    ++this.i;
    throw new Error(`tried ${this.i} times`);
  }

  @Retry({
    maxAttempts: 2,
    backOff: 1000,
  })
  async retryWithBackOff() {
    ++this.i;
    throw new Error(`tried ${this.i} times`);
  }
}

Deno.test({
  name: "@Retry() with default options",
  async fn(): Promise<void> {
    const c = new SomeClass();
    assertEquals(c.i, 0);
    try {
      await c.retryDefault();
    } catch {
      (() => {});
    }
    assertEquals(c.i, DEFAULT_MAX_ATTEMPTS + 1);
  },
});

Deno.test({
  name: "@Retry() with maxAttempts=3",
  async fn(): Promise<void> {
    const c = new SomeClass();
    assertEquals(c.i, 0);
    try {
      await c.retryWithMaxAttempts();
    } catch {
      (() => {});
    }
    assertEquals(c.i, 4);
  },
});

Deno.test({
  name: "@Retry() with backOff=1000",
  sanitizeOps: false,
  async fn(): Promise<void> {
    const c = new SomeClass();
    const t = performance.now();
    assertEquals(c.i, 0);
    try {
      await c.retryWithBackOff();
    } catch (err) {
      console.log(err);
    }
    assertEquals(c.i, 3);
    assertEquals<boolean>(performance.now() - t >= 2000, true);
  },
});
