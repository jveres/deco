// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../decorators/httpserver.decorator.ts";
import { sleep } from "../utils/utils.ts";
import { Concurrency } from "../decorators/concurrency.decorator.ts";
import { Timeout } from "../decorators/timeout.decorator.ts";
import { Trace } from "../decorators/trace.decorator.ts";

class TestServer {
  @HttpServer.Get()
  dummy() {}

  @HttpServer.Get("/test")
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
  @HttpServer.Before((request) => {
    Object.assign(request, { start: performance.now() });
    return Promise.resolve(request);
  })
  @HttpServer.After((response) => {
    response.body += ", Hello from Deco!";
    return Promise.resolve(response);
  })
  @Trace()
  hooks({ start }: { start: number }) {
    const time = Math.floor(performance.now() - start);
    return { body: `took: ${time}ms` };
  }

  @HttpServer.Get()
  @Timeout({ timeout: 2000, onTimeout: HttpServer.Status(408) })
  async timeout() {
    const max = 1000;
    const min = 4000;
    const wait = Math.floor(Math.random() * (max - min + 1)) + min;
    await sleep(wait);
    return { body: `took: ${wait}ms, ${this.#priv}` };
  }

  @HttpServer.Get()
  @Concurrency({ limit: 1 })
  @Timeout({ timeout: 2000, onTimeout: HttpServer.Status(408) })
  @Trace()
  async concurrency(
    { urlParams, signal }: { urlParams: string; signal: AbortSignal },
  ) {
    signal.addEventListener("abort", () => {
      console.log("aborted");
    });
    const params = new URLSearchParams(urlParams);
    const delay = params.get("delay") || "5";
    await sleep(Number(delay) * 1000);
    return { body: `delay: ${delay}s, resp: ${this.#priv}` };
  }
}

console.log("HttpServer() started...");
HttpServer.serve({ controllers: [TestServer] });
