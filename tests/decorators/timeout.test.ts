// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Timeout } from "../../decorators/timeout.decorator.ts";
import { assertThrowsAsync } from "https://deno.land/std@0.115.1/testing/asserts.ts";
import { sleep } from "../../utils/utils.ts";
import { setColorEnabled } from "https://deno.land/std@0.115.1/fmt/colors.ts";

class SomeClass {
  @Timeout(1000)
  async doSomething(): Promise<string> {
    await sleep(2000);
    return "result";
  }

  async doSomethingElse(): Promise<string> {
    console.log("start...");
    const res = await this.doSomething();
    console.log(`...done with "${res}"`);
    return res;
  }
}

Deno.test({
  name: "@Timeout(1000)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(): Promise<void> {
    const c = new SomeClass();
    setColorEnabled(false);
    await assertThrowsAsync(
      async (): Promise<void> => {
        await c.doSomethingElse();
      },
      Error,
      "Timeout (1000ms) exceeded for doSomething(…)",
    );
  },
});
