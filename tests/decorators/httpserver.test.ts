// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  Get,
  HttpServer,
  serve,
} from "../../decorators/httpserver.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.110.0/testing/asserts.ts";

const message = "Hello from Deco!";

@HttpServer()
class HttpController {
  @Get("/")
  get() {
    return message;
  }
}

Deno.test({
  name: "@HttpServer()",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const port = 8090;
    serve({ port, controllers: [HttpController] });
    const resp = await fetch(`http://localhost:${port}`);
    const text = await resp.text();
    assertEquals(text, message);
  },
});
