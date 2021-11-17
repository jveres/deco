// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { getMetadata, Metadata } from "../../decorators/metadata.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.115.0/testing/asserts.ts";

Deno.test({
  name: "@Metadata() -> setMetadata(), getMetadata()",
  fn() {
    const key = "meta:data";
    const value = { "a": 1, "b": "1" };
    @Metadata(key, value)
    class C {}
    const meta = getMetadata<Record<string, string>>(C, key);
    assertEquals(meta, value);
    assertEquals(meta?.constructor.name, "Object");
  },
});

Deno.test({
  name: "getMetadata() with defaultValue and type inference",
  fn() {
    const key = "meta:data";
    class C {}
    const meta = getMetadata(C, key, ["defaultValue1"]);
    assertEquals(meta.constructor.name, "Array");
    assertEquals(meta, ["defaultValue1"]);
    meta.push("defaultValue2");
    assertEquals(getMetadata(C, key), ["defaultValue1","defaultValue2"]);
  },
});
