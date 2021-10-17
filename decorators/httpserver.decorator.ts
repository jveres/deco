// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { HttpFunction, HttpMethod, Router } from "../utils/Router.ts";
import { loadOpenApiSpecification } from "../utils/openapi.ts";

export const router = new Router();

const TARGET_KEY = "__target__";
const ROUTES_KEY = "__routes__";

const addRouteToObject = (
  { method, path, handler }: {
    method: HttpMethod;
    path: string;
    handler: HttpFunction;
  },
  object: Object,
) => {
  if (!Reflect.has(object, ROUTES_KEY)) {
    Reflect.defineProperty(object, ROUTES_KEY, {
      value: [],
    });
  }
  const routes = Reflect.get(object, ROUTES_KEY) as any[];
  routes.push({ method, path, handler });
};

export interface HttpServerOptions {
  schema?: string;
}

export const HttpServer = (options: HttpServerOptions = {}): ClassDecorator =>
  (
    target: Function,
  ): void => {
    const routes: any[] = Reflect.get(target.prototype, ROUTES_KEY);
    (async () => {
      if (options.schema) {
        const api = await loadOpenApiSpecification(options.schema);
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
            addRouteToObject(
              {
                method,
                path,
                handler: () => {
                  return {
                    body: examples[Math.floor(Math.random() * examples.length)],
                    init,
                  };
                },
              },
              target.prototype,
            );
          }
        }
      }
    })().then(() => {
      const value = Reflect.construct(target, []);
      Reflect.defineProperty(target.prototype, TARGET_KEY, {
        value,
      });
      routes.forEach((route: any) => {
        router.add({
          method: route["method"],
          path: route["path"],
          action: { handler: route["handler"], target: value },
        }, true);
      });
    });
  };

export const Get = (
  path = "/",
): MethodDecorator =>
  (
    target: Object,
    _propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    addRouteToObject(
      { method: "GET", path, handler: descriptor.value },
      target,
    );
  };

export const Post = (
  path = "/",
): MethodDecorator =>
  (
    target: Object,
    _propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    addRouteToObject(
      { method: "POST", path, handler: descriptor.value },
      target,
    );
  };

export const DEFAULT_SERVER_HOSTNAME = "127.0.0.1";
export const DEFAULT_SERVER_PORT = 8080;

export interface Newable<T> {
  new (...args: any[]): T;
}

export interface ServeConfig {
  hostname?: string;
  port?: number;
  controllers: Newable<any>[];
}

export const serve = async (
  config: ServeConfig,
) => {
  for await (
    const conn of Deno.listen({
      port: config.port ?? DEFAULT_SERVER_PORT,
      hostname: config.hostname ?? DEFAULT_SERVER_HOSTNAME,
    })
  ) {
    (async () => {
      for await (const http of Deno.serveHttp(conn)) {
        const url = new URL(http.request.url);
        const { action, params } = router.find(
          http.request.method,
          url.pathname,
        );
        const { body = "", init } = await action.handler.apply(
          action.target,
          [{ ...params, url, request: http.request }],
        );
        http.respondWith(new Response(body, init));
      }
    })();
  }
};
