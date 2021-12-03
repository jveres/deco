// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../../decorators/httpserver.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.116.0/testing/asserts.ts";

const MESSAGE = "Hello from Deco!";

class ServerController {
  @HttpServer.Get()
  test() {}
}

Deno.test({
  name: "@HttpServer.Get()",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const port = 8090;
    HttpServer.serve({ port, controllers: [ServerController] });
    const resp = await fetch(`http://localhost:${port}`);
    assertEquals(resp.status, 200);
  },
});
