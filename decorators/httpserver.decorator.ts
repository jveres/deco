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

import { pTimeout } from "./timeout.decorator.ts";
import { pConcurrency } from "./concurrency.decorator.ts";

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

  static Wrapper(
    wrapper: (
      promise: () => Promise<HttpRequest | HttpResponse>,
    ) => Promise<HttpRequest | HttpResponse>,
    order = 0,
  ) {
    return function (target: any, property: string) {
      const action = HttpServer.router.createAction({ target, property });
      action.wrappers.push({ wrapper, order });
    };
  }

  static Before(hook: (request: HttpRequest) => Promise<HttpRequest>) {
    return HttpServer.Hook(hook, HttpServerHookType.Before);
  }

  static After(hook: (response: HttpResponse) => Promise<HttpResponse>) {
    return HttpServer.Hook(hook, HttpServerHookType.After);
  }

  static Timeout(timeout: number) {
    return HttpServer.Wrapper((promiseFn) =>
      pTimeout({
        promise: promiseFn(),
        timeout,
        onTimeout: () => {
          return HttpServer.Status(408)();
        },
      })
    );
  }

  static Concurrency(limit: number) {
    return function (target: any, property: string) {
      HttpServer.Wrapper((promiseFn) =>
        pConcurrency({
          promiseFn,
          limit,
          resolver: () => property
        })
      )(target, property);
    };
  }

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
      const name = action.target.constructor.name;
      if (objects.has(name)) action.target = objects.get(name);
      let fn = action.target[action.property].bind(action.target); // bind to instance
      action.wrappers.sort((a, b) => (a.order - b.order)).map( // consider order for wrapping
        (item) => {
          const prevFn = fn;
          const wrapped = () => item.wrapper(prevFn); // apply wrappers
          fn = wrapped;
        },
      );
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
