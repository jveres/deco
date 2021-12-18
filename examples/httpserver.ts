// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// curl -v -L -X GET "http://localhost:8080/redirect" -H "x-access-token: eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.AbTCrX_2fvEYk3e6IsNwtweMht6JLfma7i_PS-vzDvHZIQB3FldT80SFuIV7hje-GcCkYnQp22JJGHNOLgx4kw"

import { HttpServer } from "../decorators/httpserver.decorator.ts";
import { sleep } from "../utils/utils.ts";
import { Concurrency } from "../decorators/concurrency.decorator.ts";
import { Timeout } from "../decorators/timeout.decorator.ts";
import { Trace } from "../decorators/trace.decorator.ts";

const authKey = await crypto.subtle.importKey(
  "jwk",
  JSON.parse(Deno.readTextFileSync("./public.key")),
  {
    name: "ECDSA",
    namedCurve: "P-256",
  },
  true,
  ["verify"],
);

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

  @HttpServer.Auth({ authKey })
  @HttpServer.Get()
  redirect(
    { http, payload }: {
      http: Deno.RequestEvent;
      payload: Record<string, unknown>;
    },
  ) {
    console.log("Auth payload:", payload);
    http.respondWith(Response.redirect("http://localhost:8080/priv"));
  }

  @HttpServer.Get("/test/:id")
  dynamic({ pathParams }: { pathParams: string }) {
    return { body: `${JSON.stringify(pathParams)}` };
  }

  #priv = "Hello from Deco ! (#priv)";

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
  @Trace()
  async timeout() {
    const max = 3000;
    const min = 5000;
    const wait = Math.floor(Math.random() * (max - min + 1)) + min;
    await sleep(wait);
    return { body: `took: ${wait}ms, ${this.#priv}` };
  }

  @HttpServer.Get()
  @HttpServer.Decorate([
    Trace(),
    Timeout({ timeout: 2000, onTimeout: HttpServer.Status(408) }),
    Concurrency({ limit: 1 }),
  ])
  async concurrency(
    { urlParams, timeoutSignal }: {
      urlParams: string;
      timeoutSignal: AbortSignal;
    },
  ) {
    timeoutSignal.onabort = () => {
      console.log("timeout abort");
    };
    const params = new URLSearchParams(urlParams);
    const delay = Number.parseInt(params.get("delay") || "5");
    await sleep(delay * 1000);
    console.log("Resolve");
    return { body: `delay: ${delay}s, resp: ${this.#priv}` };
  }
}

console.log("HttpServer() started...");
HttpServer.serve({ controllers: [TestServer] });
