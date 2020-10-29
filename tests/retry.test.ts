// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.75.0/testing/asserts.ts";

import { DEFAULT_MAX_ATTEMPTS, Retry } from "../decorators/retry.decorator.ts";

class SomeClass {
  public i = 0;

  reset_i() {
    this.i = 0;
  }

  @Retry()
  async retryDefault(): Promise<void> {
    ++this.i;
    throw new Error(`tried ${this.i} times`);
  }

  @Retry({ maxAttempts: 1 })
  async retryWithMaxAttempts(): Promise<void> {
    ++this.i;
    throw new Error(`tried ${this.i} times`);
  }

  @Retry({
    maxAttempts: 1,
    backOff: 1000,
  })
  async retryWithBackOff(): Promise<void> {
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
    } catch (e: unknown) {
    }
    assertEquals(c.i, DEFAULT_MAX_ATTEMPTS + 1);
  },
});

Deno.test({
  name: "@Retry() with maxAttempts=1",
  async fn(): Promise<void> {
    const c = new SomeClass();
    assertEquals(c.i, 0);
    try {
      await c.retryWithMaxAttempts();
    } catch (e: unknown) {
    }
    assertEquals(c.i, 2);
  },
});

Deno.test({
  name: "@Retry() with backOff=1000",
  async fn(): Promise<void> {
    const c = new SomeClass();
    const t = performance.now();
    assertEquals(c.i, 0);
    try {
      await c.retryWithBackOff();
    } catch (e: unknown) {
    }
    assertEquals(c.i, 2);
    assertEquals<boolean>(performance.now() - t >= 1000, true);
  },
});
