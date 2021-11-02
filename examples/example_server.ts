// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Http } from "../decorators/httpserver.decorator.ts";

@Http.Server({ schema: "api.yaml", instantiate: false })
class _ExampleOpenAPI {}

@Http.Server()
class _ExampleCustomAPI {
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
  async post({ url, request }: { url: URL; request: Request }) {
    return {
      body: `[POST /api/:id] 😎 (got data: "${await request.text()}", query: "${
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

@Http.Server()
class _ExampleStream {
  counter = 0;

  @Http.Get("/stream")
  stream() {
    let cancelled = true;
    // deno-lint-ignore no-this-alias
    const self = this;
    const stream = new ReadableStream({
      start(controller) {
        cancelled = false;
        console.log("Stream started");
        controller.enqueue(": Welcome to the /sse endpoint!\n\n");
        (function time() {
          setTimeout(() => {
            if (!cancelled) {
              const body = `event: timer, counter\ndata: ${
                new Date().toISOString()
              }, ${++self.counter}\n\n\n`;
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
Http.serve();
