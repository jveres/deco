// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

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
  };

export const DEFAULT_SERVER_PORT = 8080;

export interface ServeOptions {
  port?: number;
  controllers?: Function[];
}

export const serve = async (
  options: ServeOptions,
) => {
  const body = new TextEncoder().encode("Hello from Deco!");
  for await (
    const conn of Deno.listen({ port: options.port ?? DEFAULT_SERVER_PORT })
  ) {
    (async () => {
      for await (const { respondWith } of Deno.serveHttp(conn)) {
        respondWith(new Response(body)).catch((e) =>
          console.log(`Error in respondWith`, e)
        );
      }
    })();
  }
};
