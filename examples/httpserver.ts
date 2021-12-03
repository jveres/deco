// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../decorators/httpserver.decorator.ts";

class _TestServer {
  @HttpServer.Get("/test")
  static() {}

  @HttpServer.Get("/test/:id")
  dynamic() {}

  #priv = "Hello from Deco!";

  @HttpServer.Get("/priv")
  priv() {
    return { body: this.#priv };
  }
}

console.log("HttpServer() started...");
HttpServer.serve({});
