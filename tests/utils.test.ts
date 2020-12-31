// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { assertEquals } from "https://deno.land/std@0.82.0/testing/asserts.ts";
import { LruCache } from "../utils.ts";

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
