// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Trace } from "../decorators/trace.decorator.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.79.0/testing/asserts.ts";
import { setColorEnabled } from "https://deno.land/std@0.79.0/fmt/colors.ts";

class SomeClass {
  @Trace()
  static doSomething() {
    console.log("logging for the console");
  }
}

Deno.test({
  name: "@Trace",
  fn() {
    setColorEnabled(false);
    const term: string[] = [];
    const log = console.log;
    // deno-lint-ignore no-explicit-any
    console.log = (x: any) => {
      term.push(x);
    };
    SomeClass.doSomething();
    assert(
      term[0].startsWith(
        "doSomething(…) called from fn (trace.test.ts:29:15) at",
      ),
    );
    assertEquals(term[1], "logging for the console");
    assert(term[2].startsWith("doSomething(…) ended in "));
    console.log = log;
  },
});
