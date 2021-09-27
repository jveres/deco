// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Get, HttpServer, serve } from "./decorators/httpserver.decorator.ts";

@HttpServer()
class HttpController {
  @Get("/")
  get() {
    return {
      message: "Hello from Deco!",
    };
  }
}

console.log("Server running...");
serve({ controllers: [HttpController] });
