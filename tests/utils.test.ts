// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { assertEquals } from "https://deno.land/std@0.107.0/testing/asserts.ts";
import { LruCache, sleep, throttle, debounce } from "../utils.ts";

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
    let calls: any = [];
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
    let calls: any = [];
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
    assertEquals(calls, [3 ,6]);
  },
});