// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.118.0/testing/asserts.ts";
import {
  consoleLogHook,
  LruCache,
} from "../utils/utils.ts";

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