// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.125.0/testing/asserts.ts";
import { HttpRouter } from "../utils/router.ts";

Deno.test({
  name: "HttpRouter with static path",
  fn() {
    const r = new HttpRouter();
    class T {}
    r.add({
      method: "GET",
      path: "/get",
      target: T,
      property: undefined!,
    });
    const res = r.find(r.getRouter(["T"]), "GET", "/get");
    assertNotEquals(res, null);
    assertNotEquals(res, undefined);
    assertEquals(res?.target, T);
  },
});

Deno.test({
  name: "HttpRouter route deduplication",
  fn() {
    const r = new HttpRouter();
    class T {}
    r.add({
      method: "GET",
      path: "/get",
      target: T,
      property: undefined!,
    });
    r.add({
      method: "GET",
      path: "/get",
      target: T,
      property: undefined!,
    });
    const res = r.find(r.getRouter(["T"]), "GET", "/get");
    assertEquals(r.routes.length, 1);
    assertNotEquals(res, null);
    assertNotEquals(res, undefined);
    assertEquals(res?.target, T);
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
    const res = r.find(r.getRouter(["C"]), "GET", "/get/1");
    assertEquals(res?.params, { id: "1" });
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
      property: "get1",
    });
    r.add({
      method: "GET",
      path: "/get/else/:id",
      target: C,
      property: "get1",
    });
    const rt = r.getRouter(["C"]);
    let res = r.find(rt, "GET", "/get/1");
    assertEquals(res?.params, { id: "1" });
    res = r.find(rt, "GET", "/get/else/1");
    assertEquals(res?.params, { id: "1" });
  },
});
