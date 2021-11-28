// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { HttpMethod, Router } from "../utils/Router.ts";
import { documentationHTML, loadOpenAPISchema } from "../utils/openapi.ts";
import { getMetadata, hasMetadata, setMetadata } from "./metadata.decorator.ts";
import { parse as yamlParse } from "https://deno.land/std@0.116.0/encoding/yaml.ts";
import * as path from "https://deno.land/std@0.116.0/path/mod.ts";
import { verify } from "https://deno.land/x/djwt@v2.4/mod.ts";
import { stringFromPropertyKey } from "../utils/utils.ts";
import { decode as base64Decode } from "https://deno.land/std@0.116.0/encoding/base64.ts";
import { RateLimit, RateLimitError } from "./ratelimit.decorator.ts";

export type FavIcon = {
  mime: "image/x-icon";
  data: Uint8Array;
};

export const DEFAULT_FAVICON: FavIcon = {
  "mime": "image/x-icon",
  "data": base64Decode(
    "AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKwAAAI8AAADVAAAA8wUFBfQKCgrWAAAAjwAAACsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAlAAAAP0AAAD/AAAA/wAAAP8oKCj/+fn5/7W1tf8+Pj79AAAAlAAAAAYAAAAAAAAAAAAAAAAAAAAGAAAAvQAAAP8AAAD/AAAA/wAAAP8AAAD/Ozs7/////////////////5CQkP8EBAS9AAAABgAAAAAAAAAAAAAAlAAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/25ubv//////////////////////kJCQ/wAAAJQAAAAAAAAAKwAAAP0AAAD/AAAA/wAAAP8DAwP/HR0d/yQkJP/Q0ND//////////////////////+Li4v8GBgb9AAAAKwAAAI8AAAD/AAAA/wwMDP8wMDD/lJSU/9HR0f/l5eX///////////////////////////+Ghob/AAAA/wAAAI8AAADVAAAA/woKCv9jY2P/////////////////////////////////////////////////OTk5/wAAAP8AAADVAAAA8wAAAP8kJCT//////////////////////////////////////////////////v7+/yEhIf8AAAD/AAAA8wAAAPMAAAD/NTU1////////////////////////////5eXl//7+/v///////////83Nzf8NDQ3/AAAA/wAAAPMAAADVAAAA/yMjI///////////////////////xMTE/wAAAP+EhIT///////////9HR0f/AAAA/wAAAP8AAADVAAAAjwAAAP8ICAj/bW1t/////////////////+jo6P9SUlL/w8PD//////+3t7f/FhYW/wAAAP8AAAD/AAAAjwAAACsAAAD9AAAA/xISEv9WVlb/8fHx//////////////////z8/P+EhIT/GBgY/wAAAP8AAAD/AAAA/QAAACsAAAAAAAAAlAAAAP8AAAD/AAAA/x4eHv8sLCz/Ozs7/zAwMP8iIiL/BQUF/wAAAP8AAAD/AAAA/wAAAJQAAAAAAAAAAAAAAAYAAAC9AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAL0AAAAGAAAAAAAAAAAAAAAAAAAABgAAAJQAAAD9AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/QAAAJQAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKwAAAI8AAADVAAAA8wAAAPMAAADVAAAAjwAAACsAAAAAAAAAAAAAAAAAAAAA+B8AAOAHAADAAwAAgAEAAIABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAAgAEAAMADAADgBwAA+B8AAA==",
  ),
};

export interface HttpMetrics {
  requests: number;
  tcp: {
    listeners: number;
  };
  http: {
    streams: number;
    connections: number;
  };
  cpus: number;
  memory: Deno.MemoryUsage;
  ops: {
    dispatched: number;
    completed: number;
  };
}

export class Http {
  static readonly TARGET_KEY = "__target__";
  static readonly ROUTES_KEY = "__routes__";
  static readonly CRYPTOKEY_KEY = "__crypto_key__";

  static readonly DEFAULT_SERVER_HOSTNAME = "127.0.0.1";
  static readonly DEFAULT_SERVER_PORT = 8080;

  static readonly router = new Router();

  static ServerController(
    { schema, cryptoKey }: {
      schema?: { fileName: string; publishPath?: string };
      cryptoKey?: CryptoKey;
    } = {},
  ): ClassDecorator {
    return (target: Function): void => {
      const routes = getMetadata<object[]>(
        target.prototype,
        Http.ROUTES_KEY,
        [],
      );
      if (schema) {
        const text = Deno.readTextFileSync(schema.fileName);
        const json = path.extname(schema.fileName) === ".yaml"
          ? yamlParse(text)
          : JSON.parse(text);
        const api = loadOpenAPISchema(json);
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
            routes.push({
              method,
              path,
              handler: () => {
                return {
                  body: examples[Math.floor(Math.random() * examples.length)],
                  init,
                };
              },
            });
          }
        }
        routes.push({
          method: "GET",
          path: `/${schema.fileName}`,
          handler: () => {
            return {
              body: text,
              init: {
                headers: { "content-type": "text/plain; charset=utf-8" },
              },
            };
          },
        });
        routes.push({
          method: "GET",
          path: schema.publishPath ?? "/openapi",
          handler: () => {
            return {
              body: documentationHTML(schema.fileName),
              init: { headers: { "content-type": "text/html" } },
            };
          },
        });
      }
      if (cryptoKey) {
        setMetadata(target, Http.CRYPTOKEY_KEY, cryptoKey);
      }
    };
  }

  static Route(
    { method = "GET", path }: { method?: HttpMethod; path?: string },
  ): MethodDecorator {
    return (
      target: object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      path ??= `/${stringFromPropertyKey(propertyKey)}`;
      getMetadata<object[]>(target, Http.ROUTES_KEY, []).push({
        method,
        path,
        handler: descriptor.value,
      });
    };
  }

  static Get(
    path?: string,
  ): MethodDecorator {
    return Http.Route({ method: "GET", path });
  }

  static Post(
    path?: string,
  ): MethodDecorator {
    return Http.Route({ method: "POST", path });
  }

  static Put(
    path?: string,
  ): MethodDecorator {
    return Http.Route({ method: "PUT", path });
  }

  static Delete(
    path?: string,
  ): MethodDecorator {
    return Http.Route({ method: "DELETE", path });
  }

  static Auth(
    { cryptoKey, headerKey = "x-access-token" }: {
      cryptoKey?: CryptoKey;
      headerKey?: string;
    } = {},
  ): MethodDecorator {
    return (
      target: object,
      _propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      const fn = descriptor.value;
      descriptor.value = async function (...args: any[]) {
        const { request }: { request: Request } = args[0];
        const token = request.headers.get(headerKey);
        if (token === null) return { init: { status: 401 } }; // Unauthorized
        try {
          cryptoKey ??= getMetadata<CryptoKey>(
            target.constructor,
            Http.CRYPTOKEY_KEY,
          );
          if (cryptoKey === undefined) throw Error("missing verification key");
          const payload = await verify(token, cryptoKey);
          Object.assign(args[0], { auth: payload });
          return await fn.apply(this, args);
        } catch (err) {
          console.error(`@Auth() exception: ${err}`);
          return { init: { status: 403 } }; // Forbidden
        }
      };
    };
  }

  static SSE({ event, data }: { event?: string; data: string | string[] }) {
    let res = event ? `event: ${event}\n` : "";
    if (typeof data === "string") res += `data: ${data}\n`;
    else data.map((data) => res += `data: ${data}\n`);
    return res;
  }

  static EventStream(
    path?: string,
  ): MethodDecorator {
    return (
      target: object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      path ??= `/${stringFromPropertyKey(propertyKey)}`;
      getMetadata<object[]>(target, Http.ROUTES_KEY, []).push({
        method: "GET",
        path,
        handler: function (...args: any[]) {
          const that = getMetadata<object>(target, Http.TARGET_KEY);
          const stream = new ReadableStream({
            async start(controller) {
              Object.assign(args[0], { controller });
              for await (const event of descriptor.value.apply(that, args)) {
                controller.enqueue(`${event}\n\n`);
              }
            },
          });
          return {
            body: stream.pipeThrough(new TextEncoderStream()),
            init: {
              headers: {
                "cache-control": "no-cache",
                "content-type": "text/event-stream",
              },
            },
          };
        },
      });
    };
  }

  static Chunked(
    path?: string,
  ): MethodDecorator {
    return (
      target: object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      path ??= `/${stringFromPropertyKey(propertyKey)}`;
      getMetadata<object[]>(target, Http.ROUTES_KEY, []).push({
        method: "GET",
        path,
        handler: function (...args: any[]) {
          const that = getMetadata<object>(target, Http.TARGET_KEY);
          const stream = new ReadableStream({
            async start(controller) {
              Object.assign(args[0], { controller });
              for await (const chunk of descriptor.value.apply(that, args)) {
                controller.enqueue(chunk);
              }
              controller.close();
            },
          });
          return {
            body: stream.pipeThrough(new TextEncoderStream()),
            init: {
              headers: {
                "content-type": "text/plain; charset=UTF-8",
                "transfer-encoding": "chunked",
              },
            },
          };
        },
      });
    };
  }

  static RateLimit({ rps }: { rps: number }): MethodDecorator {
    return (
      target: object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      RateLimit({ limit: rps, interval: 1000 })(
        target,
        propertyKey,
        descriptor,
      );
      const fn = descriptor.value;
      descriptor.value = async function (...args: any[]) {
        try {
          return await fn.apply(this, args);
        } catch (e: unknown) {
          if (e instanceof RateLimitError) {
            return { body: "Rate limit exceeded", init: { status: 429 } }; // Too many requests
          } else {
            throw e;
          }
        }
      };
    };
  }

  static metrics: HttpMetrics = {
    requests: 0,
    tcp: {
      listeners: 0,
    },
    http: {
      streams: 0,
      connections: 0,
    },
    cpus: navigator.hardwareConcurrency,
    memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
    ops: {
      dispatched: 0,
      completed: 0,
    },
  };

  static async serve(
    { hostname, port, controllers, metrics = true, favIcon = true }: {
      hostname?: string;
      port?: number;
      controllers: Function[];
      metrics?: boolean | string;
      favIcon?: boolean | FavIcon;
    },
  ) {
    // Initialize controllers and routes
    for (const controller of controllers) {
      if (!hasMetadata(controller.prototype, Http.TARGET_KEY)) {
        setMetadata(
          controller.prototype,
          Http.TARGET_KEY,
          Reflect.construct(controller, []),
        );
      }
      const target = getMetadata<object>(controller.prototype, Http.TARGET_KEY);
      const routes = getMetadata<object[]>(
        controller.prototype,
        Http.ROUTES_KEY,
        [],
      );
      routes.forEach((route: any) => {
        Http.router.add({
          method: route["method"],
          path: route["path"],
          action: { handler: route["handler"], target },
        });
      });
    }
    // Metrics
    if (metrics) {
      Http.router.add({
        method: "GET",
        path: typeof metrics === "string" ? metrics : "/metrics",
        action: {
          handler: () => {
            const metrics = Deno.metrics();
            Http.metrics.memory = Deno.memoryUsage();
            Http.metrics.ops.dispatched = metrics.opsDispatched;
            Http.metrics.ops.completed = metrics.opsCompleted;
            const resources = Deno.resources();
            Http.metrics.http.streams = Object.values(resources).reduce(
              (n, x) => n + (x === "httpStream"),
              0,
            );
            Http.metrics.http.connections = Object.values(resources).reduce(
              (n, x) => n + (x === "httpConn"),
              0,
            );
            Http.metrics.tcp.listeners = Object.values(resources).reduce(
              (n, x) => n + (x === "tcpListener"),
              0,
            );
            return {
              body: JSON.stringify(Http.metrics),
              init: { headers: { "content-type": "application/json" } },
            };
          },
        },
      });
    }
    // Favicon
    if (favIcon) {
      Http.router.add({
        method: "GET",
        path: "/favicon.ico",
        action: {
          handler: () => {
            return {
              body: typeof favIcon === "boolean"
                ? DEFAULT_FAVICON.data
                : favIcon.data,
              init: {
                headers: { "content-type": DEFAULT_FAVICON.mime },
              },
            };
          },
        },
      });
    }
    // Start listener
    for await (
      const conn of Deno.listen({
        port: port ?? Http.DEFAULT_SERVER_PORT,
        hostname: hostname ?? Http.DEFAULT_SERVER_HOSTNAME,
      })
    ) {
      (async () => {
        for await (const http of Deno.serveHttp(conn)) {
          try {
            Http.metrics.requests++;
            const url = new URL(http.request.url);
            const { action, params } = Http.router.find(
              http.request.method,
              url.pathname,
            );
            const { body, init } = await action.handler.apply(
              action.target,
              [{ ...params, url, request: http.request }],
            ) || {};
            await http.respondWith(new Response(body, init));
          } catch (err: unknown) {
            if (err instanceof Error && err.name === "Http") {
              console.warn(`Http.serve() warning: ${err.message}`);
            } else {
              throw err;
            }
          }
        }
      })();
    }
  }
}
