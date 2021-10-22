// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  Http
} from "../decorators/httpserver.decorator.ts";

@Http.Server({ schema: "api.yaml" })
class ___ {

  @Http.Get("/api")
  res() {
    return {}
  }

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
}

console.log("Server started...");
Http.serve();
