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

  static Decorate(
    decorators: Array<
      (target: any, property: string, descriptor: PropertyDescriptor) => any
    >,
  ) {
    return function (target: any, property: string) {
      const action = HttpServer.router.createAction({ target, property });
      action.decorators = action.decorators.concat(decorators);
    };
  }

  static Before(hook: (request: HttpRequest) => Promise<HttpRequest>) {
    return HttpServer.Hook(hook, HttpServerHookType.Before);
  }

  static After(hook: (response: HttpResponse) => Promise<HttpResponse>) {
    return HttpServer.Hook(hook, HttpServerHookType.After);
  }

  /*static Timeout(timeout: number) {
    return HttpServer.Wrapper((promiseFn) =>
      pTimeout({
        promise: promiseFn(),
        timeout,
        onTimeout: () => HttpServer.Status(408)(),
      })
    );
  }*/

  static Status(status: number) {
    return () => Promise.resolve({ init: { status } });
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
      const descriptor = Object.getOwnPropertyDescriptor(
        action.target,
        action.property,
      );
      if (descriptor) { // apply decorators
        action.decorators.forEach((decorator) => {
          decorator(action.target, action.property, descriptor);
        });
        Object.defineProperty(action.target, action.property, descriptor);
      }
      const name = action.target.constructor.name;
      if (objects.has(name)) action.target = objects.get(name);
      const fn = action.target[action.property].bind(action.target); // bind to instance
      action.promise = (request: HttpRequest) => {
        return [
          ...action.before, // pre-hooks
          fn, // response function
          ...action.after, // post-hooks
        ].reduce(
          (promise, next) => {
            return promise.then(next);
          },
          Promise.resolve(request),
        );
      };
    }
    const ACTION_404 = { promise: HttpServer.Status(404) };
    for await (
      const conn of Deno.listen({ port, hostname })
    ) {
      (async () => {
        for await (const http of Deno.serveHttp(conn)) {
          const [path] = http.request.url.split(":" + port)[1].split("?");
          const { promise, params } = HttpServer.router.find(
            http.request.method,
            path,
          ) || ACTION_404;
          promise({ request: http, params }).then((response: any) =>
            http.respondWith(new Response(response?.body, response?.init))
              .catch(() => {}) // catch Http errors
          );
          //).catch(() => {}); // catch app errors
        }
      })().catch(() => {}); // catch serveHttp errors, e.g. curl -v -X GET "http://localhost:8080/wrapped "
    }
  }
}
