// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import {
  HttpMethod,
  HttpRequest,
  HttpResponse,
  HttpRouter,
} from "../utils/router.ts";
import { consoleLogHook } from "../utils/utils.ts";
import { verify } from "https://deno.land/x/djwt@v2.4/mod.ts";
import * as Colors from "https://deno.land/std@0.125.0/fmt/colors.ts";
import { basename } from "https://deno.land/std@0.125.0/path/mod.ts";
import { deepMerge } from "https://deno.land/std@0.125.0/collections/mod.ts";

export type { HttpMethod, HttpRequest, HttpResponse };

export class AbortError extends Error {}

const DEFAULT_HTTPSERVER_HOSTNAME = "127.0.0.1";
const DEFAULT_HTTPSERVER_PORT = 8080;

enum HttpServerHookType {
  Before,
  After,
}

interface EventStreamEventFormat {
  event?: string;
  data: string | string[];
  id?: string;
  retry?: number;
}

interface EventStreamCommentFormat {
  comment: string;
}

declare global {
  namespace Deno {
    interface RequestEvent {
      abortWith(r?: Response | Promise<Response>): any;
    }
  }

  namespace Response {
    function Status(status: number): Response;
  }
}

Response.Status = function (status: number) {
  return new Response(null, { status });
};

consoleLogHook({
  logPrefix: Colors.green("[l]"),
  warnPrefix: Colors.rgb24("[w]", 0xff8080),
  errorPrefix: Colors.red("[E]"),
  infoPrefix: Colors.rgb24("[i]", 0xbada55),
});

export class HttpServer {
  static router = new HttpRouter();

  static Route(
    { method = "GET", path }: { method?: HttpMethod; path?: string },
  ) {
    return function (target: any, property: string) {
      path ||= "/" + property;
      HttpServer.router.add({
        method,
        path,
        target,
        property,
      });
    };
  }

  static Get(
    path?: string,
  ) {
    return HttpServer.Route({ path });
  }

  static Put(
    path?: string,
  ) {
    return HttpServer.Route({ method: "PUT", path });
  }

  static Post(
    path?: string,
  ) {
    return HttpServer.Route({ method: "POST", path });
  }

  static Delete(
    path?: string,
  ) {
    return HttpServer.Route({ method: "DELETE", path });
  }

  static Options(
    path?: string,
  ) {
    return HttpServer.Route({ method: "OPTIONS", path });
  }

  static Hook(hook: any, type: HttpServerHookType) {
    return function (target: any, property: string) {
      const route = HttpServer.router.createAction({ target, property });
      if (type === HttpServerHookType.Before) route.action.before.push(hook);
      else route.action.after.push(hook);
    };
  }

  static Before(hook: (request: HttpRequest) => Promise<HttpRequest>) {
    return HttpServer.Hook(hook, HttpServerHookType.Before);
  }

  static After(hook: (response: HttpResponse) => Promise<HttpResponse>) {
    return HttpServer.Hook(hook, HttpServerHookType.After);
  }

  static Decorate(
    decorators: Array<
      (target: any, property: string, descriptor: PropertyDescriptor) => void
    >,
  ) {
    return function (target: any, property: string) {
      const route = HttpServer.router.createAction({ target, property });
      route.action.decorators = route.action.decorators.concat(decorators);
    };
  }

  static Auth({ authKey, headerKey = "x-access-token" }: {
    authKey: CryptoKey;
    headerKey?: string;
  }) {
    return HttpServer.Before(async (request) => {
      const token = request.http.request.headers.get(headerKey);
      if (token === null) {
        return request.http.abortWith(Response.Status(401)); // Unauthorized
      }
      try {
        const payload = await verify(token, authKey);
        Object.assign(request, { payload });
      } catch (err: unknown) {
        console.error(`@Auth() ${err}`);
        return request.http.abortWith(Response.Status(403)); // Forbidden
      }
      return Promise.resolve(request);
    });
  }

  static Html() {
    return HttpServer.After((html) => {
      const response = {
        body: html as string,
        init: { headers: { "content-type": "text/html" } },
      };
      return Promise.resolve(response);
    });
  }

  static RequestInit(init: (request: HttpRequest) => Record<string, unknown>) {
    return HttpServer.Before((req) => {
      return Promise.resolve(deepMerge(req, init(req)) as HttpRequest);
    });
  }

  static ResponseInit(
    init: (response: HttpResponse) => Record<string, unknown>,
  ) {
    return HttpServer.After((resp) => {
      return Promise.resolve(deepMerge(resp, init(resp)) as HttpResponse);
    });
  }

  static Static(
    { assets, path }: {
      assets: Array<{ fileName: string; path?: string; contentType: string }>;
      path?: string;
    },
  ) {
    return function (
      target: any,
      property: string,
      descriptor: PropertyDescriptor,
    ) {
      path ??= "/" + property;
      if (path.endsWith("/")) path = path.slice(0, path.length - 1); // remove trailing slash
      const map = new Map<string, any>();
      for (const asset of assets) {
        const urlPath = asset.path ?? `${path}/${basename(asset.fileName)}`;
        map.set(urlPath, {
          body: Deno.readFileSync(asset.fileName),
          init: { headers: { "content-type": asset.contentType } },
        });
        HttpServer.router.add({
          method: "GET",
          path: urlPath,
          target,
          property,
        });
      }
      const origFn = descriptor.value;
      descriptor.value = function (...args: any[]) {
        origFn.apply(this, args);
        const { path } = args[0];
        return map.get(path);
      };
    };
  }

  static SSE(event: EventStreamEventFormat | EventStreamCommentFormat): string {
    if ("comment" in event) {
      return `: ${event.comment}`;
    } else {
      let res = event.event ? `event: ${event.event}\n` : "";
      if (typeof event.data === "string") res += `data: ${event.data}\n`;
      else event.data.map((data) => res += `data: ${data}\n`);
      if (event.id) res += `id: ${event.id}\n`;
      if (event.retry) res += `retry: ${event.retry}\n`;
      return res;
    }
  }

  static Chunked(contentType = "text/plain") {
    return HttpServer.Decorate([
      (_target: any, _property: string, descriptor: PropertyDescriptor) => {
        const fn = descriptor.value;
        descriptor.value = function (...args: any[]) {
          const stream = new ReadableStream({
            async start(controller) {
              try {
                for await (
                  const event of fn.apply(this, args)
                ) {
                  controller.enqueue(`${event}\n\n`);
                }
              } catch (e: unknown) {
                controller.error(e);
              } finally {
                controller.close();
              }
            },
          });
          return {
            body: stream.pipeThrough(new TextEncoderStream()),
            init: {
              headers: {
                "cache-control": "no-cache",
                "content-type": contentType,
              },
            },
          };
        };
      },
    ]);
  }

  static Status(status: number) {
    return () => Promise.resolve({ init: { status } });
  }

  static async serve(
    {
      hostname = DEFAULT_HTTPSERVER_HOSTNAME,
      port = DEFAULT_HTTPSERVER_PORT,
      abortSignal,
      controllers = [],
      onStarted,
      onError,
      onClosed,
      log = true,
    }: {
      hostname?: string;
      port?: number;
      abortSignal?: AbortSignal;
      controllers: Function[];
      onStarted?: () => void;
      onError?: (e: unknown) => void;
      onClosed?: () => void;
      log?: boolean;
    },
  ) {
    const objects = new Map<string, any>();
    for (const controller of controllers) {
      const name = controller.name;
      if (!objects.has(name)) {
        objects.set(name, Reflect.construct(controller, [])); // instantiate controller object
      }
    }
    // routing setup
    const targets = Array.from(objects.keys());
    for (
      const route of HttpServer.router.routes.filter((route) =>
        targets.includes(route.action.target.constructor.name)
      )
    ) {
      const action = route.action;
      const descriptor = Object.getOwnPropertyDescriptor(
        action.target,
        action.property,
      );
      if (descriptor) { // apply decorators
        action.decorators.forEach((decorator) => {
          decorator(action.target, action.property, descriptor);
        });
        Object.defineProperty(action.target, action.property, descriptor);
      }
      const name = action.target.constructor.name;
      if (objects.has(name)) action.target = objects.get(name);
      const fn = action.target[action.property].bind(action.target); // bind to instance
      action.promise = (request: HttpRequest) => {
        return [
          ...action.before, // pre-hooks
          fn, // response function
          ...action.after, // post-hooks
        ].reduce(
          (promise, next) => {
            return promise.then(next);
          },
          Promise.resolve(request),
        );
      };
    }
    const router = HttpServer.router.getRouter(targets);
    const NOT_FOUND = { promise: HttpServer.Status(404), params: undefined };
    const server = Deno.listen({ port, hostname });
    abortSignal?.addEventListener("abort", () => {
      server.close();
      HttpServer.router.clearAll();
    });
    onStarted?.();
    for await (const conn of server) {
      (async () => {
        for await (const http of Deno.serveHttp(conn)) {
          http.abortWith = (r = new Response()) => { // helper for aborting the response chain
            http.respondWith(r).catch(() => {});
            throw new AbortError();
          };
          const [path, urlParams] = http.request.url.split(
            http.request.headers.get("host")!,
            2,
          )[1]
            .split(
              "?",
            );
          const { promise, params: pathParams } =
            HttpServer.router.find(router, http.request.method, path) ??
              NOT_FOUND;
          if (log) { // request logging
            console.log(
              `${
                promise === NOT_FOUND.promise
                  ? Colors.brightRed(http.request.method)
                  : Colors.brightGreen(http.request.method)
              } ${http.request.url}`,
            );
          }
          promise({ conn, http, path, pathParams, urlParams })
            .then((
              response: HttpResponse,
            ) =>
              http.respondWith(new Response(response?.body, response?.init))
                .catch(onError) // catch Http errors
            )
            .catch((e: unknown) => { // catch promise chain errors
              if (!(e instanceof AbortError)) {
                if (onError) {
                  http.respondWith(
                    Response.Status(500),
                  ).catch(() => {}); // swallow Http errors
                  onError(e);
                } else throw e;
              } // swallow AbortError
            });
        }
      })()
        .catch(onError); // catch serveHttp errors
    }
    onClosed?.();
  }
}
