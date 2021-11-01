// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Http } from "../decorators/httpserver.decorator.ts";

@Http.Server({ schema: "api.yaml" })
class _API {}

@Http.Server()
class _ExampleServer {
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
      }")`,
    };
  }

  @Http.Get("/static/*")
  static({ "*": path }: { "*": string }) {
    return {
      body: `[GET /static/*] 😎 (got path: "${path}")`,
    };
  }

  @Http.Get("/sse")
  stream() {
    let cancelled = true;
    const stream = new ReadableStream({
      start: (controller) => {
        cancelled = false;
        console.log("Stream started");
        controller.enqueue(": Welcome to the /sse endpoint!\n\n");
        (function time() {
          setTimeout(() => {
            if (!cancelled) {
              const body = `event: timer\ndata: ${
                new Date().toISOString()
              }\n\n\n`;
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
