// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Metadata } from "../../decorators/metadata.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.109.0/testing/asserts.ts";

Deno.test({
  name: "@Metadata()",
  fn() {
    const key = "meta:data";
    const value = { "a": 1, "b": "1" };
    @Metadata(key, value)
    class Klass {}
    assertEquals(Reflect.get(Klass, key), value);
  },
});
