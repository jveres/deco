// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// curl http://localhost:8080/api
// curl http://localhost:8080/api/1
// curl -v -X POST "http://localhost:8080/api?q=1" -d "test data" -H "x-access-token: eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZGVjbyJ9.ae9rDEkN3goWCuc1-Dsbm9lX7kVJPHC8dlnKMFI1Gs-Y26kvGGo0UyQkMih0-zicLgx1viGLSufwfOctC1nWLQ"

import { Http } from "../decorators/httpserver.decorator.ts";

@Http.ServerController({ schema: { fileName: "api.yaml" } })
class ExampleOpenAPI {}

const key = await crypto.subtle.importKey(
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

  @Http.Post("/api")
  @Http.Auth({ cryptoKey: key })
  async post(
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
}

@Http.ServerController()
class ExampleStream {
  @Http.Get("/stream")
  stream() {
    let cancelled = true;
    let counter = 0;
    const stream = new ReadableStream({
      start(controller) {
        cancelled = false;
        console.log("Stream started");
        controller.enqueue(": Welcome to the /stream endpoint!\n\n");
        (function time() {
          setTimeout(() => {
            if (counter > 9) {
              console.log("Stream closed");
              controller.close();
            } else if (!cancelled) {
              const body = `event: timer, counter\ndata: ${
                new Date().toISOString()
              }, ${++counter}\n\n\n`;
              controller.enqueue(body);
              time();
            }
          }, 1000);
        })();
      },
      cancel() {
        cancelled = true;
        console.log("Stream cancelled");
      },
    });
    return {
      body: stream.pipeThrough(new TextEncoderStream()),
      init: { headers: { "content-type": "text/event-stream" } },
    };
  }
}

console.log("Server started...");
Http.serve({ controllers: [ExampleOpenAPI, ExampleCustomAPI, ExampleStream] });
