// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  assert,
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.127.0/testing/asserts.ts";
import { consoleLogHook, LruCache, sleep } from "../utils/utils.ts";

Deno.test({
  name: "sleep()",
  async fn() {
    const t = performance.now();
    await sleep(500);
    assert(performance.now() - t > 500);
  },
});

Deno.test({
  name: "sleep() with abort signal",
  async fn() {
    const c = new AbortController();
    const s = c.signal;
    await assertRejects(
      async () => {
        await Promise.all([
          sleep(1000, s),
          Promise.resolve(c.abort()),
        ]);
      },
      DOMException,
      "Aborted",
    );
    assertEquals(s.aborted, true);
  },
});

Deno.test({
  name: "LruCache<number> with default size",
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
  name: "LruCache<number> with size = 10",
  fn() {
    const c = new LruCache<number>(10);
    for (let i = 1; i < 11; i++) {
      c.put(`${i}`, i);
    }
    assertEquals(c.get("1"), 1);
    c.put("11", 11);
    assertEquals(c.get("1"), 1);
    assertEquals(c.get("2"), undefined);
    assertEquals(c.has("11"), true);
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
