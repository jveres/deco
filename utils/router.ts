// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import {
  createRouter,
  RadixRouter,
} from "https://cdn.skypack.dev/radix3@0.1.0?dts";

export type HttpMethod = "GET";

export type HttpRequest = {
  conn: Deno.Conn;
  http: Deno.RequestEvent;
  path: string;
  pathParams?: Record<string, unknown>;
  urlParams?: string;
};

export type HttpResponse = Response;

export type HttpAction = {
  target: { [key: string]: any };
  property: string;
  fn: (request: HttpRequest) => Promise<HttpResponse>;
  wrapperFn: (
    fn: () => Promise<HttpResponse>,
    ...args: any[]
  ) => Promise<HttpResponse>;
  beforeFn: (request: HttpRequest) => void | HttpResponse | Promise<HttpResponse>;
};

export type HttpRoute = {
  method: HttpMethod;
  path: string;
  action: HttpAction;
};

export class HttpRouter {
  readonly routes = new Array<HttpRoute>();

  createAction(
    { target, property }: {
      target: { [key: string]: any };
      property: string;
    },
  ) {
    const route = this.routes.find((route) =>
      route.action.target === target && route.action.property === property
    );
    if (!route) {
      const action: HttpAction = {
        target,
        property,
        fn: undefined!,
        wrapperFn: undefined!,
        beforeFn: undefined!,
      };
      return this
        .routes[
          this.routes.push({ method: undefined!, path: undefined!, action }) - 1
        ];
    } else {
      return route;
    }
  }

  add({ method, path, target, property }: {
    method: HttpMethod;
    path: string;
    target: { [key: string]: any };
    property: string;
  }) {
    const route = this.createAction({ target, property });
    if (route.method && route.path) {
      if (route.method !== method || route.path !== path) {
        this.routes.push({ method, path, action: route.action });
      } else {
        console.error(
          `HttpRouter.add(): route already added ${route.method} ${route.path}`,
        );
      }
    } else {
      route.method = method;
      route.path = path;
    }
    return route;
  }

  getRouter(targets: string[]) {
    const router = new Map</* method */ string, RadixRouter<HttpAction>>();
    for (const route of this.routes) {
      const target = route.action.target;
      const name = typeof target === "function"
        ? target.name
        : target.constructor.name;
      if (targets.indexOf(name) > -1) {
        if (!router.has(route.method)) router.set(route.method, createRouter());
        router.get(route.method)!.insert(
          route.path,
          route.action,
        );
      }
    }
    return router;
  }

  find(
    router: Map<string, RadixRouter<HttpAction>>,
    method: string,
    path: string,
  ) {
    return router.get(method)?.lookup(path);
  }

  clearAll() {
    this.routes.length = 0;
  }
}
