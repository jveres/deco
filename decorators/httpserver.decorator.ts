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
import consoleHook from "../utils/consoleHook.ts";
import * as Colors from "https://deno.land/std@0.128.0/fmt/colors.ts";
import { deepMerge } from "https://deno.land/std@0.128.0/collections/mod.ts";
import { abortable } from "https://deno.land/std@0.128.0/async/abortable.ts";

export type { HttpMethod, HttpRequest, HttpResponse };

const DEFAULT_HTTPSERVER_HOSTNAME = "127.0.0.1";
const DEFAULT_HTTPSERVER_PORT = 8080;

consoleHook({
  logPrefix: Colors.green("[LOG]"),
  warnPrefix: Colors.rgb24("[WARN]", 0xff8080),
  errorPrefix: Colors.red("[ERR]"),
  infoPrefix: Colors.rgb24("[INF]", 0xbada55),
});

export class HttpServer {
  static router = new HttpRouter();

  static Route(
    { method = "GET", path }: { method?: HttpMethod; path?: string },
  ) {
    return function <
      T extends (...args: any[]) =>
        | HttpResponse
        | Promise<HttpResponse>
        | AsyncGenerator<string | ResponseInit>,
    >(
      target: any,
      property: string,
      _descriptor: TypedPropertyDescriptor<T>,
    ) {
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

  static Wrap(
    fn: (
      fn: () => Promise<HttpResponse>,
      request: HttpRequest,
    ) => Promise<HttpResponse>,
  ) {
    return function <
      T extends (request: HttpRequest) => HttpResponse | Promise<HttpResponse>,
    >(
      target: any,
      property: string,
      _descriptor: TypedPropertyDescriptor<T>,
    ) {
      const route = HttpServer.router.createAction({ target, property });
      if (route.action.wrapperFn !== undefined) {
        throw Error(`Wrapper function already defined for ${property}`);
      }
      route.action.wrapperFn = fn;
    };
  }

  static Before(
    fn: (request: HttpRequest) => void | HttpResponse | Promise<HttpResponse>,
  ) {
    return function <
      T extends (
        args: any,
      ) => HttpResponse | Promise<HttpResponse> | AsyncGenerator<string>,
    >(
      target: any,
      property: string,
      _descriptor: TypedPropertyDescriptor<T>,
    ) {
      const route = HttpServer.router.createAction({ target, property });
      if (route.action.beforeFn !== undefined) {
        throw Error(`Before function already defined for ${property}`);
      }
      route.action.beforeFn = fn;
    };
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
      const target_ctor = action.target.constructor.name;
      if (objects.has(target_ctor)) action.target = objects.get(target_ctor);
      const fn = action.target[action.property].bind(action.target); // bind to instance
      const fn_ctor = fn.constructor.name;
      switch (fn_ctor) { // configure callback function
        case "Function":
        case "AsyncFunction":
          if (fn_ctor === "Function") {
            action.fn = async (request: HttpRequest) => {
              if (action.beforeFn !== undefined) {
                const res = await action.beforeFn(request);
                if (res instanceof Response) return res;
              }
              return fn(request);
            };
          } else action.fn = fn;
          if (action.wrapperFn !== undefined) {
            const fn = action.fn;
            // deno-lint-ignore require-await
            action.fn = async (...args: any[]) =>
              action.wrapperFn(fn.bind(this, ...args), ...args);
          }
          break;
        case "AsyncGeneratorFunction":
          action.fn = async (request: HttpRequest) => {
            if (action.beforeFn !== undefined) {
              const res = await action.beforeFn(request);
              if (res instanceof Response) return res;
            }
            const it = fn(request) as AsyncGenerator;
            const chunks = abortable(
              it,
              request.signal,
            );
            const { value, done } = await chunks.next();
            const requestInit = deepMerge({
              headers: {
                "cache-control": "no-store",
                "content-type": "text/plain",
              },
            }, (typeof value === "object" && !done) ? value : {});
            let cancelled = false;
            const stream = new ReadableStream({
              pull(controller) {
                if (cancelled) return;
                //console.log("pulling");
                return chunks.next().then(({ value, done }) => {
                  //console.log("pulled");
                  cancelled = !!done;
                  if (done) return;
                  controller.enqueue(value);
                }).catch((e) => {
                  cancelled = true;
                  if (!(e instanceof DOMException)) onError?.(e);
                  else {
                    //console.log("pulling aborted");
                    it.return(null);
                    controller.close();
                  }
                });
              },
            });
            return new Response(
              stream.pipeThrough(new TextEncoderStream()),
              requestInit,
            );
          };
          break;
        default:
          throw Error("Unknown action type: " + fn_ctor);
      }
    }
    const router = HttpServer.router.getRouter(targets);
    const NOT_FOUND = {
      fn: () => Promise.resolve(new Response(null, { status: 404 })),
      params: undefined,
    };
    const server = Deno.listen({ port, hostname });
    abortSignal?.addEventListener("abort", () => {
      server.close();
      HttpServer.router.clearAll();
    });
    onStarted?.();
    for await (const conn of server) {
      (async () => {
        const req = Deno.serveHttp(conn)[Symbol.asyncIterator]();
        const abortController = new AbortController();
        const signal = abortController.signal;
        while (true) {
          const { value: http, done } = await req.next();
          if (done) {
            abortController.abort();
            break;
          }
          const [path, urlParams] = http.request.url.split(
            http.request.headers.get("host")!,
            2,
          )[1]
            .split(
              "?",
            );
          const { fn, params: pathParams } =
            HttpServer.router.find(router, http.request.method, path) ??
              NOT_FOUND;
          if (log) { // log request
            console.log(
              `${
                fn === NOT_FOUND.fn
                  ? Colors.brightRed(http.request.method)
                  : Colors.brightGreen(http.request.method)
              } ${http.request.url}`,
            );
          }
          fn({ conn, http, path, pathParams, urlParams, signal })
            .then(http.respondWith).catch(() => {}) // swallow Http errors
            .catch((e) => { // catch promise chain errors
              if (onError) {
                http.respondWith(
                  new Response(null, { status: 500 }),
                ).catch(() => {}); // swallow Http errors
                onError(e);
              } else throw e;
            });
        }
      })()
        .catch(onError); // catch serveHttp errors
    }
    onClosed?.();
  }
}
