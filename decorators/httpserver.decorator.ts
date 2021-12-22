// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

import {
  HttpMethod,
  HttpRequest,
  HttpResponse,
  HttpRouter,
} from "../utils/HttpRouter.ts";
import { consoleLogHook } from "../utils/utils.ts";
import { verify } from "https://deno.land/x/djwt@v2.4/mod.ts";
import * as Colors from "https://deno.land/std@0.118.0/fmt/colors.ts";

export type { HttpMethod, HttpRequest, HttpResponse };

export class AbortError extends Error {}

const DEFAULT_HTTPSERVER_HOSTNAME = "127.0.0.1";
const DEFAULT_HTTPSERVER_PORT = 8080;

enum HttpServerHookType {
  Before,
  After,
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
  logPrefix: Colors.green("[i]"),
  warnPrefix: Colors.yellow("[w]"),
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
      const action = HttpServer.router.createAction({ target, property });
      if (type === HttpServerHookType.Before) action.before.push(hook);
      else action.after.push(hook);
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
      const action = HttpServer.router.createAction({ target, property });
      action.decorators = action.decorators.concat(decorators);
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
    }: {
      hostname?: string;
      port?: number;
      abortSignal?: AbortSignal;
      controllers: Function[];
      onStarted?: () => void;
      onError?: (e: unknown) => void;
      onClosed?: () => void;
    },
  ) {
    const objects = new Map<string, any>();
    for (const controller of controllers) {
      const name = controller.name;
      if (!objects.has(name)) {
        objects.set(name, Reflect.construct(controller, []));
      }
    }
    for (const action of HttpServer.router.actions) {
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
    onStarted?.();
    const NOT_FOUND = { promise: HttpServer.Status(404) };
    const server = Deno.listen({ port, hostname });
    abortSignal?.addEventListener("abort", () => {
      server.close();
      HttpServer.router.clear();
      onClosed?.();
    });
    for await (const conn of server) {
      (async () => {
        for await (const http of Deno.serveHttp(conn)) {
          http.abortWith = (r?: Response | Promise<Response>) => { // helper for aborting the response chain
            http.respondWith(r ?? new Response());
            throw new AbortError();
          };
          const [path, urlParams] = http.request.url.split(":" + port)[1].split(
            "?",
          );
          const { promise, params: pathParams } = HttpServer.router.find(
            http.request.method,
            path,
          ) || NOT_FOUND;
          promise({ conn, http, pathParams, urlParams }).then((
            response: HttpResponse,
          ) =>
            http.respondWith(new Response(response?.body, response?.init))
              .catch(onError) // catch Http errors
          ).catch((e: unknown) => {
            if (e instanceof AbortError) return;
            if (onError) return onError(e);
            else throw e;
          }); // catch promise chain errors
        }
      })().catch(onError); // catch serveHttp errors, e.g. curl -v -X GET "http://localhost:8080/wrapped "
    }
  }
}
