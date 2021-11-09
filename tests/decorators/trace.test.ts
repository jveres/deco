// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Trace } from "../../decorators/trace.decorator.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.114.0/testing/asserts.ts";
import { setColorEnabled } from "https://deno.land/std@0.114.0/fmt/colors.ts";

class SomeClass {
  @Trace()
  static doSomething() {
    console.log("logging for the console");
  }
}

Deno.test({
  name: "@Trace()",
  fn() {
    setColorEnabled(false);
    const term: string[] = [];
    const log = console.log;
    console.log = (...args) => {
      term.push(args.join(" "));
    };
    SomeClass.doSomething();
    assert(
      term[0].endsWith(
        "tests/decorators/trace.test.ts:28:15)",
      ),
    );
    assertEquals(term[1], "logging for the console");
    assert(term[2].startsWith("doSomething(…) ended in"));
    console.log = log;
  },
});
