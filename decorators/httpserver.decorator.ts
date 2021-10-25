// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { HttpFunction, HttpMethod, Router } from "../utils/Router.ts";
import { loadOpenApiSpecification } from "../utils/openapi.ts";

export class Http {
  static readonly TARGET_KEY = "__http_target__";
  static readonly ROUTES_KEY = "__http_routes__";

  static readonly DEFAULT_SERVER_HOSTNAME = "127.0.0.1";
  static readonly DEFAULT_SERVER_PORT = 8080;

  static readonly router = new Router();

  static getRoutesForObject(object: object) {
    if (!Reflect.has(object, Http.ROUTES_KEY)) {
      Reflect.defineProperty(object, Http.ROUTES_KEY, {
        value: [],
      });
    }
    return Reflect.get(object, Http.ROUTES_KEY);
  }

  static addRouteToObject(
    { method, path, handler, object }: {
      method: HttpMethod;
      path: string;
      handler: HttpFunction;
      object: object;
    },
  ) {
    const routes = Http.getRoutesForObject(object) as object[];
    routes.push({ method, path, handler });
  }

  static Server({ schema }: { schema?: string } = {}): ClassDecorator {
    return (target: Function): void => {
      const routes = Http.getRoutesForObject(target.prototype);
      (async () => {
        if (schema) {
          const api = await loadOpenApiSpecification(schema);
          for (const endpoint of api) {
            const examples: string[] = [];
            endpoint.responses?.[0]?.contents?.[0]?.examples?.map((
              example: any,
            ) => examples.push(example["value"]));
            const method: HttpMethod = (endpoint.method as string)
              .toUpperCase() as HttpMethod;
            const path: string = endpoint.path;
            const status = parseInt(endpoint.responses?.[0]?.code) || 200;
            const mime = endpoint.responses?.[0]?.contents?.[0].mediaType ||
              "text/plain";
            const headers = { "content-type": mime };
            const init: ResponseInit = { status, headers };
            if (
              routes.findIndex((route: any) =>
                route["method"] === method && route["path"] === path
              ) === -1
            ) {
              Http.addRouteToObject(
                {
                  method,
                  path,
                  handler: () => {
                    return {
                      body:
                        examples[Math.floor(Math.random() * examples.length)],
                      init,
                    };
                  },
                  object: target.prototype,
                },
              );
            }
          }
        }
      })().then(() => {
        const value = Reflect.construct(target, []);
        Reflect.defineProperty(target.prototype, Http.TARGET_KEY, {
          value,
        });
        routes.forEach((route: any) => {
          Http.router.add({
            method: route["method"],
            path: route["path"],
            action: { handler: route["handler"], target: value },
          });
        });
      });
    };
  }

  static Route(
    { method, path }: { method: HttpMethod; path: string },
  ): MethodDecorator {
    return (
      target: Object,
      _propertyKey: string | Symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      Http.addRouteToObject(
        { method, path, handler: descriptor.value, object: target },
      );
    };
  }

  static Get(
    path = "/",
  ): MethodDecorator {
    return Http.Route({ method: "GET", path });
  }

  static Post(
    path = "/",
  ): MethodDecorator {
    return Http.Route({ method: "POST", path });
  }

  static async serve(
    { hostname, port }: {
      hostname?: string;
      port?: number;
    } = {},
  ) {
    for await (
      const conn of Deno.listen({
        port: port ?? Http.DEFAULT_SERVER_PORT,
        hostname: hostname ?? Http.DEFAULT_SERVER_HOSTNAME,
      })
    ) {
      (async () => {
        for await (const http of Deno.serveHttp(conn)) {
          const url = new URL(http.request.url);
          const { action, params } = Http.router.find(
            http.request.method,
            url.pathname,
          );
          const { body = "", init } = await action.handler.apply(
            action.target,
            [{ ...params, url, request: http.request }],
          ) || {};
          http.respondWith(new Response(body, init));
        }
      })();
    }
  }
}
