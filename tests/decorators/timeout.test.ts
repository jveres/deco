// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { Timeout, TimeoutError } from "../../decorators/timeout.decorator.ts";
import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.125.0/testing/asserts.ts";
import { sleep } from "../../utils/utils.ts";

Deno.test({
  name: "@Timeout({ timeout: 1000 })",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(): Promise<void> {
    class Test {
      @Timeout({ timeout: 1000 })
      async doSomething() {
        await sleep(2000);
        return "result";
      }
      async doSomethingElse() {
        console.log("start...");
        const res = await this.doSomething();
        console.log(`...done with "${res}"`);
        return res;
      }
    }
    const c = new Test();
    await assertRejects(
      async (): Promise<void> => {
        await c.doSomethingElse();
      },
      TimeoutError,
    );
  },
});

Deno.test({
  name: "@Timeout({ timeout: 1000, onTimeout: () = ... })",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(): Promise<void> {
    class Test {
      @Timeout({ timeout: 1000, onTimeout: () => "timeout" })
      async test() {
        await sleep(2000);
        return "result";
      }
    }
    const t = new Test();
    const res = await t.test();
    assertEquals(res, "timeout");
  },
});

Deno.test({
  name: "TimeoutSignal passed",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    class Test {
      @Timeout({ timeout: 1000 })
      test(args: any) {
        return args;
      }
    }
    const t = new Test();
    const res = await t.test({});
    assertEquals(typeof res.timeoutSignal, "object");
    assert(res.timeoutSignal instanceof AbortSignal);
  },
});
