// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { HttpFunction, HttpMethod, Router } from "../utils/Router.ts";
import { loadOpenApiSpecification } from "../utils/openapi.ts";

export const router = new Router();

interface HttpServerOptions {
  schema?: string;
}

const addToRouter = (
  method: HttpMethod,
  path: string,
  handler: HttpFunction,
  object: Object,
  upsert = true,
) => {
  const target = Reflect.construct(object.constructor, []);
  router.add(
    method,
    path,
    { handler, target },
    upsert,
  );
};

export const HttpServer = (options: HttpServerOptions = {}): ClassDecorator =>
  (
    target: Function,
  ): void => {
    (async () => {
      if (options.schema) {
        const api = await loadOpenApiSpecification(options.schema);
        for (const endpoint of api) {
          const examples: string[] = [];
          endpoint.responses?.[0]?.contents?.[0]?.examples?.map((
            example: any,
          ) => examples.push(example["value"]));
          const method: string = (endpoint.method as string).toUpperCase();
          const path: string = endpoint.path;
          const status = parseInt(endpoint.responses?.[0]?.code) || 200;
          const mime = endpoint.responses?.[0]?.contents?.[0].mediaType ||
            "text/plain";
          const headers = { "content-type": mime };
          const init: ResponseInit = { status, headers };
          addToRouter(
            method as HttpMethod,
            path,
            () => {
              return {
                body: examples[Math.floor(Math.random() * examples.length)],
                init,
              };
            },
            target,
            false,
          );
        }
      }
    })();
  };

export const Get = (
  path = "/",
): MethodDecorator =>
  (
    target: Object,
    _propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    addToRouter("GET", path, descriptor.value, target);
  };

export const Post = (
  path = "/",
): MethodDecorator =>
  (
    target: Object,
    _propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    addToRouter("POST", path, descriptor.value, target);
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
        const { body, init } = await action.handler.apply(
          action.target,
          [{ ...params, url, request: http.request }],
        );
        http.respondWith(new Response(body, init)).catch(() => {});
      }
    })();
  }
};
