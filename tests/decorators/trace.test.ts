// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Trace } from "../../decorators/trace.decorator.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.116.0/testing/asserts.ts";

class SomeClass {
  @Trace()
  static doSomething() {
    console.log("logging for the console");
  }
}

Deno.test({
  name: "@Trace()",
  fn() {
    const term: string[] = [];
    const log = console.log;
    console.log = (...args) => {
      term.push(args.join(" "));
    };
    SomeClass.doSomething();
    assert(
      term[0].endsWith(
        "tests/decorators/trace.test.ts:26:15)",
      ),
    );
    assertEquals(term[1], "logging for the console");
    assert(term[2].startsWith("doSomething() finished in"));
    console.log = log;
  },
});
