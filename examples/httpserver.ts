// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../decorators/httpserver.decorator.ts";
import { sleep } from "../utils/utils.ts";

class TestServer {
  @HttpServer.Get("/test")
  static() {}

  @HttpServer.Get("/test/:id")
  dynamic() {}

  #priv = "Hello from Deco!";

  @HttpServer.Get()
  priv() {
    return { body: this.#priv };
  }

  @HttpServer.Get()
  async async() {
    await sleep(1000);
    return { body: this.#priv };
  }
}

console.log("HttpServer() started...");
HttpServer.serve({controllers: [TestServer]});
