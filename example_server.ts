// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  Get,
  HttpServer,
  PathParam,
  serve,
} from "./decorators/httpserver.decorator.ts";

@HttpServer({ schema: "api.yaml" })
class HttpServerController {
  @Get("/api/:id")
  deco({ id, url }: { id: string; url: URL }) {
    return {
      body: `Hello from implemented API 😎 (got id: "${id}", query: "${decodeURIComponent(url.searchParams.toString())}")`,
    };
  }
}

console.log("Server started...");
serve({ controllers: [HttpServerController] });
