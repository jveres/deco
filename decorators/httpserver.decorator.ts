// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types

import { HttpMethod, HttpRouter } from "../utils/Router.ts";

const DEFAULT_HTTPSERVER_HOSTNAME = "127.0.0.1";
const DEFAULT_HTTPSERVER_PORT = 8080;

export class HttpServer {
  static router = new HttpRouter();

  static AddRoute(
    { method = "GET", path }: { method?: HttpMethod; path: string },
  ) {
    HttpServer.router.add({ method, path });
  }

  static Get(
    path?: string,
  ) {
    return function (_target: object, methodName: string) {
      path ??= "/" + methodName;
      return HttpServer.AddRoute({ path });
    };
  }

  static async serve(
    {
      hostname = DEFAULT_HTTPSERVER_HOSTNAME,
      port = DEFAULT_HTTPSERVER_PORT,
      controllers = [],
    }: {
      hostname?: string;
      port?: number;
      controllers: Function[];
    },
  ) {
    for await (
      const conn of Deno.listen({ port, hostname })
    ) {
      (async () => {
        for await (const http of Deno.serveHttp(conn)) {
          const [path] = http.request.url.split(":" + port)[1].split("?");
          const action = HttpServer.router.find(http.request.method, path);
          console.log(action);
          http.respondWith(new Response()).catch(() => {});
        }
      })();
    }
  }
}
