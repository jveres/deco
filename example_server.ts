// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Get, HttpServer, serve } from "./decorators/httpserver.decorator.ts";

@HttpServer({ schema: "api.yaml" })
class HttpServerController {
  @Get("/deco")
  deco() {
    return {
      body: "Hello from Deco!",
    };
  }
}

console.log("Server started...");
serve({ controllers: [HttpServerController] });
