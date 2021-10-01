// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpResponse, Router } from "../utils/Router.ts";

const router = new Router();

export const HttpServer = (): ClassDecorator =>
  (
    target: Function,
  ): void => {
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
          console.log(`Error in respondWith`, e)
        );
      }
    })();
  }
};
