// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Timeout } from "../decorators/timeout.decorator.ts";
import { assertThrowsAsync } from "https://deno.land/std@0.75.0/testing/asserts.ts";
import { sleep } from "../utils.ts";
import { setColorEnabled } from "https://deno.land/std@0.75.0/fmt/colors.ts";

class SomeClass {
  @Timeout(1000)
  async doSomething() {
    console.log("sleeping for 2000 ms");
    await sleep(5000);
  }
}

Deno.test({
  name: "@Timeout(1000)",
  sanitizeOps: false,
  async fn(): Promise<void> {
    const c = new SomeClass();
    setColorEnabled(false);
    await assertThrowsAsync(
      c.doSomething,
      Error,
      "Timeout (1000ms) exceeded for doSomething(…)",
    );
  },
});
