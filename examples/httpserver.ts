// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../decorators/httpserver.decorator.ts";
import { sleep } from "../utils/utils.ts";

class TestServer {
  @HttpServer.Get()
  dummy() {}

  @HttpServer.Before((r) => {
    console.log(r);
    Object.assign(r, { metadata: Date.now() });
    return Promise.resolve(r);
  })
  @HttpServer.After((r) => {
    console.log(r);
    return Promise.resolve(r);
  })
  @HttpServer.Get("/test")
  static(request: Record<string, unknown>) {
    console.log(request);
    return { body: "Hello from Deco!" };
  }

  @HttpServer.Before((r) => {
    r.request.respondWith(new Response("Not allowed", { status: 405 }));
    return Promise.reject("Not allowed");
  })
  @HttpServer.Post("/test")
  test() {
    console.log("POST /test");
    return { body: "Hello from Deco!" };
  }

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

  @HttpServer.Get()
  @HttpServer.Timeout(1000)
  async timeout() {
    await sleep(2000);
    return { body: this.#priv };
  }
}

console.log("HttpServer() started...");
HttpServer.serve({ controllers: [TestServer] });
