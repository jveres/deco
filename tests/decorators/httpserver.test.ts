// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Http } from "../../decorators/httpserver.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.113.0/testing/asserts.ts";

const MESSAGE = "Hello from Deco!";

@Http.Server()
class _ {
  #message = MESSAGE;

  @Http.Get("/")
  get() {
    return { body: this.#message };
  }
}

Deno.test({
  name: "@HttpServer()",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const port = 8090;
    Http.serve({ port });
    const resp = await fetch(`http://localhost:${port}`);
    const text = await resp.text();
    assertEquals(text, MESSAGE);
  },
});
