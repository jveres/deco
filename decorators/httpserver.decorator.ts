// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import {
  HttpMethod,
  HttpRequest,
  HttpResponse,
  HttpRouter,
} from "../utils/Router.ts";

const DEFAULT_HTTPSERVER_HOSTNAME = "127.0.0.1";
const DEFAULT_HTTPSERVER_PORT = 8080;

enum HttpServerHookType {
  Before,
  After,
}

export class HttpServer {
  static router = new HttpRouter();

  static Route(
    { method = "GET", path }: { method?: HttpMethod; path?: string },
  ) {
    return function (target: any, property: string) {
      path ||= "/" + property;
      HttpServer.router.add({
        method,
        path,
        target,
        property,
      });
    };
  }

  static Get(
    path?: string,
  ) {
    return HttpServer.Route({ path });
  }

  static Post(
    path?: string,
  ) {
    return HttpServer.Route({ method: "POST", path });
  }

  static Hook(hook: any, type: HttpServerHookType) {
    return function (target: any, property: string) {
      const action = HttpServer.router.createAction({ target, property });
      if (type === HttpServerHookType.Before) action.before.push(hook);
      else action.after.push(hook);
    };
  }

  static Before(hook: (request: HttpRequest) => Promise<HttpRequest>) {
    return HttpServer.Hook(hook, HttpServerHookType.Before);
  }

  static After(hook: (response: HttpResponse) => Promise<HttpResponse>) {
    return HttpServer.Hook(hook, HttpServerHookType.After);
  }

  static ["404"]() {
    return () => Promise.resolve({ body: null, init: { status: 404 } });
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
    const objects = new Map<string, any>();
    for (const controller of controllers) {
      const name = controller.name;
      if (!objects.has(name)) {
        objects.set(name, Reflect.construct(controller, []));
      }
    }
    for (const action of HttpServer.router.actions) {
      const name = action.target.constructor.name;
      if (objects.has(name)) action.target = objects.get(name); // bind to instance
      action.promise = (request: HttpRequest) => {
        return [
          ...action.before, // pre-hooks
          action.target[action.property].bind(action.target), // response function
          ...action.after, // post-hooks
        ].reduce(
          (promise, next) => {
            return promise.then(next);
          },
          Promise.resolve(request),
        );
      };
    }
    for await (
      const conn of Deno.listen({ port, hostname })
    ) {
      (async () => {
        for await (const http of Deno.serveHttp(conn)) {
          const [path] = http.request.url.split(":" + port)[1].split("?");
          const promise = HttpServer.router.find(http.request.method, path) ||
            HttpServer["404"]();
          promise({ request: http.request }).then((response = {}) =>
            http.respondWith(new Response(response.body, response.init))
              .catch(
                () => {},
              ) // swallow Http errors
          );
        }
      })();
    }
  }
}
