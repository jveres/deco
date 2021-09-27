// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  Get,
  HttpServer,
  serve,
} from "../../decorators/httpserver.decorator.ts";
import { sleep } from "../../utils.ts";
import { assertEquals } from "https://deno.land/std@0.108.0/testing/asserts.ts";

@HttpServer()
class HttpController {
  @Get("/")
  get() {
    return {
      message: "Hello from Deco!",
    };
  }
}

Deno.test({
  name: "@HttpServer()",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    serve({ controllers: [HttpController] });
    const resp = await fetch("http://localhost:8080");
    assertEquals(await resp.text(), "Hello from Deco!");
  },
});
