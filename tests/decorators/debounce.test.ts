// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { Debounce } from "../../decorators/debounce.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.113.0/testing/asserts.ts";
import { sleep } from "../../utils/utils.ts";

class SomeClass {
  @Debounce(100)
  static doSomething1(arr: any[], data: any) {
    arr.push(data);
  }

  @Debounce(100)
  static doSomething2(arr: any[], data: any) {
    arr.push(data);
  }
}

Deno.test({
  name: "@Debounce(100)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    let res: any[] = [];
    SomeClass.doSomething1(res, 1);
    SomeClass.doSomething1(res, 2);
    SomeClass.doSomething1(res, 3);
    await sleep(150);
    assertEquals(res, [3]);
    res = [];
    for (let i = 4; i <= 6; i++) {
      await SomeClass.doSomething2(res, i);
    }
    await sleep(150);
    assertEquals(res, [6]);
  },
});
