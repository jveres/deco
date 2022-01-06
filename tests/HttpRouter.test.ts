// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { HttpRouter } from "../utils/HttpRouter.ts";

Deno.test({
  name: "HttpRouter with static path",
  fn() {
    const r = new HttpRouter();
    r.add({
      method: "GET",
      path: "/get",
      target: undefined!,
      property: undefined!,
    });
    const res = r.find("GET", "/get");
    assertNotEquals(res, null);
  },
});

Deno.test({
  name: "HttpRouter with dynamic path",
  fn() {
    const r = new HttpRouter();
    class C {
      test() {}
    }
    r.add({
      method: "GET",
      path: "/get/:id",
      target: C,
      property: "test",
    });
    const res = r.find("GET", "/get/1");
    assertEquals(res.params, { id: "1" });
  },
});

Deno.test({
  name: "HttpRouter with multiple paths",
  fn() {
    const r = new HttpRouter();
    class C {
      get() {}
    }
    r.add({
      method: "GET",
      path: "/get/:id",
      target: C,
      property: "get",
    });
    r.add({
      method: "GET",
      path: "/get/else/:id",
      target: C,
      property: "get",
    });
    let res = r.find("GET", "/get/1");
    assertEquals(res.params, { id: "1" });
    res = r.find("GET", "/get/else/1");
    assertEquals(res.params, { id: "1" });
  },
});
