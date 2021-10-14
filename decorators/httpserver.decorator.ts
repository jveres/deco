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
  action: HttpFunction,
  upsert = true,
) => {
  router.add(
    method,
    path,
    action,
    upsert,
  );
};

export const HttpServer = (options: HttpServerOptions = {}): ClassDecorator =>
  (
    _target: Function,
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
          addToRouter(method as HttpMethod, path, () => {
            return {
              body: examples[Math.floor(Math.random() * examples.length)],
              init,
            };
          }, false);
        }
      }
    })();
  };

export const Get = (
  path = "/",
): MethodDecorator =>
  (
    _target: Object,
    _propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    addToRouter("GET", path, descriptor.value);
  };

export const Post = (
  path = "/",
): MethodDecorator =>
  (
    _target: Object,
    _propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    addToRouter("POST", path, descriptor.value);
  };

export const DEFAULT_SERVER_HOSTNAME = "127.0.0.1";
export const DEFAULT_SERVER_PORT = 8080;

export interface ServeConfig {
  hostname?: string;
  port?: number;
  controller: object;
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
        const { body, init } = await action.apply(config.controller, [
          { ...params, url, request: http.request },
        ]);
        http.respondWith(new Response(body, init)).catch(() => {});
      }
    })();
  }
};
