// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Throttle } from "../../decorators/throttle.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.107.0/testing/asserts.ts";
import { sleep } from "../../utils.ts";

class SomeClass {
  @Throttle(100)
  static doSomething1(arg: any) {
    return arg;
  }

  @Throttle(100)
  static async doSomething2(arg: any) {
    return arg;
  }

  @Throttle(100)
  static async doSomething3(arg: any) {
    await sleep(100);
    return arg;
  }
}

Deno.test({
  name: "@Throttle(100)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    let res = [];
    for (let i = 1; i <= 3; i++) {
      res.push(SomeClass.doSomething1(i));
    }
    assertEquals(res, [1, 1, 1]);
    res = [];
    for (let i = 4; i <= 6; i++) {
      res.push(await SomeClass.doSomething2(i));
    }
    assertEquals(res, [4, 4, 4]);
    res = [];
    for (let i = 7; i <= 9; i++) {
      res.push(await SomeClass.doSomething3(i));
    }
    assertEquals(res, [7, 8, 9]);
  },
});
