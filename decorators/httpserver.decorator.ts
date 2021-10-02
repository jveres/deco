// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpMethod, Router } from "../utils/Router.ts";
import { loadOpenApiSpecification } from "../utils/openapi.ts";

const router = new Router();

interface HttpServerOptions {
  openAPI?: string;
}

export const HttpServer = (options: HttpServerOptions = {}): ClassDecorator =>
  (
    target: Function,
  ): void => {
    (async () => {
      if (options.openAPI) {
        const api = await loadOpenApiSpecification(options.openAPI);
        //console.log(api);
        for (const endpoint of api) {
          // TODO: create mock response generator in openapi.ts
          const method: string = (endpoint.method as string).toUpperCase();
          const path: string = endpoint.path;
          const status = parseInt(endpoint.responses?.[0]?.code) || 200;
          const body = endpoint.responses?.[0]?.contents?.[0]?.examples?.[0]?.value || "Mock response";
          router.add(
            method as HttpMethod,
            path,
            (() => {
              return { body, status  };
            }),
          );
        }
      }
    })();
  };

export const Get = (
  path: string = "/",
): MethodDecorator =>
  (
    target: Object,
    propertyKey: string | Symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ): void => {
    router.add(
      "GET",
      path,
      descriptor.value,
    );
  };

export const DEFAULT_SERVER_HOSTNAME = "127.0.0.1";
export const DEFAULT_SERVER_PORT = 8080;

interface Newable<T> {
  new (...args: any[]): T;
}

export interface ServeOptions {
  hostname?: string;
  port?: number;
  controllers?: Newable<any>[];
}

export const serve = async (
  options: ServeOptions,
) => {
  options.controllers?.map((controller) => new controller());
  for await (
    const conn of Deno.listen({
      port: options.port ?? DEFAULT_SERVER_PORT,
      hostname: options.hostname ?? DEFAULT_SERVER_HOSTNAME,
    })
  ) {
    (async () => {
      for await (const http of Deno.serveHttp(conn)) {
        const url = new URL(http.request.url);
        const { handle, params } = router.find(
          http.request.method,
          url.pathname,
        );
        const { body, status = 200 } = handle(params);
        //console.log(http.request, handle, params);
        http.respondWith(new Response(body, { status })).catch((e) =>
          console.error("Error during response:", e)
        );
      }
    })();
  }
};
