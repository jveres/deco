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
    { method = "GET", path, target, property }: {
      method?: HttpMethod;
      path: string;
      target: Object;
      property: string;
    },
  ) {
    HttpServer.router.add({ method, path, target, property });
  }

  static Get(
    path?: string,
  ) {
    return function (target: Object, property: string) {
      path ??= "/" + property;
      return HttpServer.AddRoute({ path, target, property });
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
    const objects = new Map<string, Object>();
    for (const controller of controllers) {
      const name = controller.name;
      if (!objects.has(name)) {
        objects.set(name, Reflect.construct(controller, []));
      }
    }
    for (const [_, routes] of HttpServer.router.routes) {
      for (const route of routes) {
        const name = route.target.constructor.name;
        if (objects.has(name)) {
          route.target = objects.get(name)!;
        }
      }
    }
    for await (
      const conn of Deno.listen({ port, hostname })
    ) {
      (async () => {
        for await (const http of Deno.serveHttp(conn)) {
          const [path] = http.request.url.split(":" + port)[1].split("?");
          const route = HttpServer.router.find(
            http.request.method,
            path,
          );
          const { body, init } = await route.target[route.property]() || {};
          http.respondWith(new Response(body, init)).catch(
            () => {/* swallow Http errors */},
          );
        }
      })();
    }
  }
}
