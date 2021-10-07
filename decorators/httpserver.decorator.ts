// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpMethod, Router } from "../utils/Router2.ts";
import { loadOpenApiSpecification } from "../utils/openapi.ts";

const router = new Router();

interface HttpServerOptions {
  schema?: string;
}

export const HttpServer = (options: HttpServerOptions = {}): ClassDecorator =>
  (
    target: Function,
  ): void => {
    (async () => {
      if (options.schema) {
        const api = await loadOpenApiSpecification(options.schema);
        //console.log(api);
        for (const endpoint of api) {
          const examples: string[] = [];
          endpoint.responses?.[0]?.contents?.[0]?.examples?.map((example: any) => examples.push(example["value"]));
          const method: string = (endpoint.method as string).toUpperCase();
          const path: string = endpoint.path;
          const status = parseInt(endpoint.responses?.[0]?.code) || 200;
          const mime = endpoint.responses?.[0]?.contents?.[0].mediaType ||
            "text/plain";
          const body =
            endpoint.responses?.[0]?.contents?.[0]?.examples?.[0]?.value ||
            "Hello from mock endpoint.";
          const headers = { "content-type": mime };
          const init: ResponseInit = { status, headers };
          router.add(
            method as HttpMethod,
            path,
            (() => {
              return { body: examples[Math.floor(Math.random() * examples.length)], init };
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
        const { handler, params } = router.find(
          http.request.method,
          url.pathname,
        );
        const { body, init } = handler(params);
        http.respondWith(new Response(body, init)).catch();
      }
    })();
  }
};
