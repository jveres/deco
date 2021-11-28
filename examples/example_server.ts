// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// curl http://localhost:8080/api
// curl http://localhost:8080/api/1
// curl -v -X POST "http://localhost:8080/api?q=1" -d "test data" -H "x-access-token: eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZGVjbyJ9.ae9rDEkN3goWCuc1-Dsbm9lX7kVJPHC8dlnKMFI1Gs-Y26kvGGo0UyQkMih0-zicLgx1viGLSufwfOctC1nWLQ"
// curl --raw -X GET http://localhost:8080/chunked

import { Http } from "../decorators/httpserver.decorator.ts";
import { sleep } from "../utils/utils.ts";
import { DECO_VERSION } from "../mod.ts";

@Http.ServerController({ schema: { fileName: "api.yaml" } })
class ExampleOpenAPI {}

const cryptoKey = await crypto.subtle.importKey(
  "jwk",
  JSON.parse(Deno.readTextFileSync("key.jwk")),
  { name: "HMAC", hash: "SHA-512" },
  true,
  [
    "sign",
    "verify",
  ],
);

@Http.ServerController()
class ExampleCustomAPI {
  counter = 0;

  @Http.Get("/api/:id")
  get({ id, url }: { id: string; url: URL }) {
    return {
      body: `[GET /api/:id] 😎 (got id: "${id}", query: "${
        decodeURIComponent(url.searchParams.toString())
      }")`,
    };
  }

  @Http.Post()
  @Http.Auth({ cryptoKey })
  async api(
    { url, request, auth }: {
      url: URL;
      request: Request;
      auth: Record<string, unknown>;
    },
  ) {
    const data = await request.text();
    return {
      body: `[POST /api] 😎 (got data: "${data}", auth data: "${
        JSON.stringify(auth)
      }", query: "${
        decodeURIComponent(url.searchParams.toString())
      }", counter="${++this.counter}")`,
    };
  }

  @Http.Get("/static/*")
  static({ "*": path }: { "*": string }) {
    return {
      body: `[GET /static/*] 😎 (got path: "${path}")`,
    };
  }

  @Http.Get()
  dummy() {}
}

@Http.ServerController()
class ExampleStream {
  @Http.EventStream()
  async *stream() {
    yield ": Hello from stream\n\n";
    while (true) {
      await sleep(1000);
      yield `event: tick\ndata: ${new Date().toISOString()}\n\n\n`;
    }
  }
 
  @Http.Chunked()
  async *chunked() {
    for (let i = 1; i < 11; i++) {
      yield `chunk #${i}`;
      await sleep(1000);
    }
  }
}

@Http.ServerController()
class ExampleLimits {
  @Http.Get()
  @Http.RateLimit({ rps: 1 })
  ratelimited() {}
}

console.log(`Deco (v${DECO_VERSION}) http server started...`);
Http.serve({
  controllers: [ExampleOpenAPI, ExampleCustomAPI, ExampleStream, ExampleLimits],
});
