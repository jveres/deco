// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Timeout, TimeoutError } from "../../decorators/timeout.decorator.ts";
import { assertRejects } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { sleep } from "../../utils/utils.ts";

class SomeClass {
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

Deno.test({
  name: "@Timeout({timeout: 1000})",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(): Promise<void> {
    const c = new SomeClass();
    await assertRejects(
      async (): Promise<void> => {
        await c.doSomethingElse();
      },
      TimeoutError,
    );
  },
});
