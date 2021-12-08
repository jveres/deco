// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { HttpServer } from "../decorators/httpserver.decorator.ts";
import { sleep } from "../utils/utils.ts";

class TestServer {
  @HttpServer.Get()
  dummy() {}

  @HttpServer.Get("/test")
  @HttpServer.Wrapper((promise: any) => {
    const unwrap = promise();
    console.log("unwrap =", unwrap);
    return promise;
  })
  static() {
    return { body: "Hello from Deco!" };
  }

  @HttpServer.Post("/test")
  test() {
    return { body: "Hello from Deco!" };
  }

  @HttpServer.Get("/test/:id")
  dynamic(r: Record<string, unknown>) {
    return { body: `${JSON.stringify(r.params)}` };
  }

  @HttpServer.Get()
  @HttpServer.Wrapper((promise: any) => {
    const unwrap = promise;
    console.log("unwrap =", unwrap);
    unwrap.body += " 2️";
    return unwrap;
  }, 1)
  @HttpServer.Wrapper((promise: any) => {
    const unwrap = promise;
    console.log("unwrap =", unwrap);
    unwrap.body += " 1️";
    return unwrap;
  }, 2)
  wrapped() {
    return { body: "Hello from Deco!" };
  }

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
  @HttpServer.Timeout(3000)
  async timeout() {
    await sleep(2000);
    return { body: this.#priv };
  }
}

console.log("HttpServer() started...");
HttpServer.serve({ controllers: [TestServer] });
