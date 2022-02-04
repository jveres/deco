// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file require-await

import { Try } from "../../decorators/try.decorator.ts";
import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.125.0/testing/asserts.ts";

class SomeClass {
  @Try()
  doSomething() {
    throw "error";
  }

  @Try({
    log: true,
  })
  doSomething1() {
    throw "error";
  }

  @Try({
    log: true,
    errors: ["TypeError"],
  })
  doSomething2() {
    throw TypeError("type error");
  }

  @Try({
    errors: ["Error"],
  })
  async doSomething3() {
    throw TypeError("fake type error");
  }
}

Deno.test({
  name: "@Try()",
  fn() {
    const c = new SomeClass();
    const term: string[] = [];
    const error = console.error;
    console.error = (...args) => {
      term.push(args.join(" "));
    };
    c.doSomething();
    assert(term.length === 0);
    console.error = error;
  },
});

Deno.test({
  name: "@Try({ log: true })",
  fn() {
    const c = new SomeClass();
    const term: string[] = [];
    const error = console.error;
    console.error = (...args) => {
      term.push(args.join(" "));
    };
    c.doSomething1();
    assertEquals(term[0], "doSomething1(): error");
    console.error = error;
  },
});

Deno.test({
  name: '@Try({ log: true, errors: ["TypeError"] })',
  fn() {
    const c = new SomeClass();
    const term: string[] = [];
    const error = console.error;
    console.error = (...args) => {
      term.push(args.join(" "));
    };
    c.doSomething2();
    assertEquals(term[0], "doSomething2(): TypeError: type error");
    console.error = error;
  },
});

Deno.test({
  name: '@Try({ errors: ["TypeError"] })',
  async fn() {
    const c = new SomeClass();
    await assertRejects(
      c.doSomething3,
      TypeError,
      "fake type error",
    );
  },
});
