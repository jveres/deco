// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../decorators/httpserver.decorator.ts";

class TestServer {
  @HttpServer.Get()
  static() {}

  @HttpServer.Get("/pattern/:id")
  pattern() {}
}

console.log("HttpServer() started...");
HttpServer.serve({ controllers: [] });
