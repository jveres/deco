// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Try } from "../../decorators/try.decorator.ts";
import {
  assert,
  assertEquals,
  assertThrowsAsync,
} from "https://deno.land/std@0.107.0/testing/asserts.ts";
import { setColorEnabled } from "https://deno.land/std@0.107.0/fmt/colors.ts";

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
    catch: ["TypeError"],
  })
  doSomething2() {
    throw TypeError("type error");
  }

  @Try({
    catch: ["TypeError"],
  })
  doSomething3() {
    throw Error("error");
  }
}

Deno.test({
  name: "@Try()",
  fn() {
    const c = new SomeClass();
    setColorEnabled(false);
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
    setColorEnabled(false);
    const term: string[] = [];
    const error = console.error;
    console.error = (...args) => {
      term.push(args.join(" "));
    };
    c.doSomething1();
    assertEquals(term[0], "Runtime exception: error");
    console.error = error;
  },
});

Deno.test({
  name: '@Try({ log: true, catch: ["*"] })',
  fn() {
    const c = new SomeClass();
    setColorEnabled(false);
    const term: string[] = [];
    const error = console.error;
    console.error = (...args) => {
      term.push(args.join(" "));
    };
    c.doSomething1();
    assertEquals(term[0], "Runtime exception: error");
    console.error = error;
  },
});

Deno.test({
  name: '@Try({ log: true, catch: ["error"] })',
  fn() {
    const c = new SomeClass();
    setColorEnabled(false);
    const term: string[] = [];
    const error = console.error;
    console.error = (...args) => {
      term.push(args.join(" "));
    };
    c.doSomething1();
    assertEquals(term[0], "Runtime exception: error");
    console.error = error;
  },
});

Deno.test({
  name: '@Try({ log: true, catch: ["TypeError"] })',
  fn() {
    const c = new SomeClass();
    setColorEnabled(false);
    const term: string[] = [];
    const error = console.error;
    console.error = (...args) => {
      term.push(args.join(" "));
    };
    c.doSomething2();
    assertEquals(term[0], "Runtime exception: type error");
    console.error = error;
  },
});

Deno.test({
  name: '@Try({ catch: ["TypeError"] })',
  async fn() {
    const c = new SomeClass();
    await assertThrowsAsync(
      async (): Promise<void> => {
        await c.doSomething3();
      },
    );
  },
});
