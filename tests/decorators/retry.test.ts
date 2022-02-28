// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file require-await

import {
  BackOffPolicy,
  DEFAULT_MAX_ATTEMPTS,
  Retry,
} from "../../decorators/retry.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.127.0/testing/asserts.ts";

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

  @Retry({
    maxAttempts: 4,
    backOffPolicy: BackOffPolicy.ExponentialBackOffPolicy,
    backOff: 1000,
    exponentialOption: {
      maxInterval: 5000,
      multiplier: 1.2,
    },
    doRetry(_err: unknown) {
      console.log("retrying...");
      return true;
    },
  })
  async retryWithExponentialBackOff() {
    ++this.i;
    throw new Error(`tried ${this.i} times`);
  }

  @Retry({
    doRetry() {
      return false;
    },
  })
  async retrywithHandler() {
    ++this.i;
    throw new Error(`tried ${this.i} times`);
  }
}

Deno.test({
  name: "@Retry() with default options",
  async fn(): Promise<void> {
    const c = new SomeClass();
    assertEquals(c.i, 0);
    await c.retryDefault().catch(() => {});
    assertEquals(c.i, DEFAULT_MAX_ATTEMPTS + 1);
  },
});

Deno.test({
  name: "@Retry() with maxAttempts=3",
  async fn(): Promise<void> {
    const c = new SomeClass();
    assertEquals(c.i, 0);
    await c.retryWithMaxAttempts().catch(() => {});
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
      if (err instanceof Error) console.error(`@Retry(): ${err.message}`);
      else console.error(err);
    }
    assertEquals(c.i, 3);
    assertEquals<boolean>(performance.now() - t >= 2000, true);
  },
});

Deno.test({
  name:
    "@Retry() with ExponentialBackOff: maxAttempts=4, backOff=1000, maxInterval=1000, multiplier=2",
  sanitizeOps: false,
  async fn(): Promise<void> {
    const c = new SomeClass();
    const t = performance.now();
    assertEquals(c.i, 0);
    try {
      await c.retryWithExponentialBackOff();
    } catch (err) {
      if (err instanceof Error) console.error(`@Retry(): ${err.message}`);
      else console.error(err);
    }
    assertEquals(c.i, 5);
    assertEquals<boolean>(
      performance.now() - t >= 1000 + 1200 + 1440 + 1728,
      true,
    );
  },
});

Deno.test({
  name: "@Retry() with doRetry(...) handler",
  async fn(): Promise<void> {
    const c = new SomeClass();
    assertEquals(c.i, 0);
    await c.retrywithHandler().catch(() => {});
    assertEquals(c.i, 1);
  },
});
