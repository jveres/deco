// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import { HttpMethod, Router } from "../utils/Router.ts";
import { documentationHTML, loadOpenAPISchema } from "../utils/openapi.ts";
import { getMetadata, hasMetadata, setMetadata } from "./metadata.decorator.ts";
import { parse as yamlParse } from "https://deno.land/std@0.115.1/encoding/yaml.ts";
import * as path from "https://deno.land/std@0.115.1/path/mod.ts";
import { verify } from "https://deno.land/x/djwt@v2.4/mod.ts";

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
      if (schema) {
        const text = Deno.readTextFileSync(schema.fileName);
        const json = path.extname(schema.fileName) === ".yaml"
          ? yamlParse(text)
          : JSON.parse(text);
        const api = loadOpenAPISchema(json);
        const routes = getMetadata<object[]>(
          target.prototype,
          Http.ROUTES_KEY,
          [],
        );
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
    { method, path }: { method: HttpMethod; path: string },
  ): MethodDecorator {
    return (
      target: Object,
      _propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>,
    ): void => {
      getMetadata<object[]>(target, Http.ROUTES_KEY, []).push({
        method,
        path,
        handler: descriptor.value,
      });
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

  static Put(
    path = "/",
  ): MethodDecorator {
    return Http.Route({ method: "PUT", path });
  }

  static Delete(
    path = "/",
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
      target: Object,
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

  static async serve(
    { hostname, port, controllers }: {
      hostname?: string;
      port?: number;
      controllers: Function[];
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
    // Start listener
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
          http.respondWith(new Response(body, init)).catch(() => {});
        }
      })();
    }
  }
}
