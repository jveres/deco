// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  Get,
  HttpServer,
  Post,
  serve,
} from "../decorators/httpserver.decorator.ts";

@HttpServer({ schema: "api.yaml" })
class ServerController {
  @Get("/api/:id")
  get({ id, url }: { id: string; url: URL }) {
    return {
      body: `[GET /api/:id] 😎 (got id: "${id}", query: "${
        decodeURIComponent(url.searchParams.toString())
      }")`,
    };
  }

  @Post("/api")
  async post({ url, request }: { url: URL; request: Request }) {
    return {
      body: `[POST /api/:id] 😎 (got data: "${await request.text()}", query: "${
        decodeURIComponent(url.searchParams.toString())
      }")`,
    };
  }

  @Get("/static/*")
  assets({ "*": path }: { "*": string }) {
    return {
      body: `[GET /static/*] 😎 (got path: "${path}")`,
    };
  }

  @Get("/grip")
  stream({ request }: { request: Request }) {
    return {
      body: "hello\n",
      init: {
        headers: {
          "content-type": "text/event-stream",
          "grip-hold": "stream",
          "grip-channel": "stream",
        },
      },
    };
  }
}

console.log("Server started...");
serve({ controllers: [ServerController] });
