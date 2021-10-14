// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.111.0/testing/asserts.ts";
import {
  consoleLogHook,
  debounce,
  LruCache,
  sleep,
  throttle,
} from "../utils/utils.ts";
import Node from "../utils/tree.js";

Deno.test({
  name: "LruCache<T> with 501 numbers",
  fn() {
    const c = new LruCache<number>();
    for (let i = 1; i < 501; i++) {
      c.put(`${i}`, i);
    }
    assertEquals(c.get("1"), 1);
    c.put("501", 501);
    assertEquals(c.get("1"), 1);
    assertEquals(c.get("2"), undefined);
    assertEquals(c.has("501"), true);
  },
});

Deno.test({
  name: "throttle()",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const calls: any = [];
    const fn = throttle((arg: any) => calls.push(arg), 100);
    fn(1);
    await sleep(50);
    fn(2);
    await sleep(50);
    fn(3);
    await sleep(50);
    fn(4);
    assertEquals(calls, [1, 2]);
    await sleep(50);
    fn(5);
    await sleep(50);
    fn(6);
    await sleep(50);
    fn(7);
    await sleep(50);
    fn(8);
    assertEquals(calls, [1, 2, 4, 6]);
  },
});

Deno.test({
  name: "debounce()",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const calls: any = [];
    const fn = debounce((arg: any) => calls.push(arg), 100);
    fn(1);
    fn(2);
    fn(3);
    await sleep(100);
    assertEquals(calls, [3]);
    fn(4);
    fn(5);
    fn(6);
    await sleep(100);
    assertEquals(calls, [3, 6]);
  },
});

Deno.test({
  name: "consoleLogHook()",
  fn() {
    const { "log": _log, "info": _info, "warn": _warn, "error": _error } =
      console;
    consoleLogHook({ logPrefix: " LOG " });
    console.log("testing console log hook");
    assertNotEquals(console.log, _log);
    assertEquals(console.info, _info);
    assertEquals(console.warn, _warn);
    assertEquals(console.error, _error);
    consoleLogHook({ errorPrefix: " ERROR " });
    console.error("testing console error hook");
    assertNotEquals(console.error, _error);
    consoleLogHook({ infoPrefix: " INFO ", warnPrefix: " WARN " });
    console.info("testinng console info hook");
    console.warn("testinng console warn hook");
    assertNotEquals(console.info, _info);
    assertNotEquals(console.warn, _warn);
  },
});

Deno.test({
  name: "Node() with static, named and catch-all patterns",
  fn() {
    const n = new Node(); // Radix tree
    const h = () => {};
    n.addRoute("/static", h);
    n.addRoute("/named/:id", h);
    n.addRoute("/catch-all/*param", h);
    {
      const { handle, params } = n.search("/static");
      console.log(handle);
      assertNotEquals(handle, null);
      assertEquals(params, []);
    }
    {
      const { handle, params } = n.search("/named/123456");
      assertNotEquals(handle, null);
      assertEquals(params, [{ key: "id", value: "123456" }]);
    }
    {
      const { handle, params } = n.search("/catch-all/test/param");
      assertNotEquals(handle, null);
      assertEquals(params, [{ key: "param", value: "/test/param" }]);
    }
  },
});
