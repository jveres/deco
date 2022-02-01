// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import {
  createRouter,
  RadixRouter,
} from "https://cdn.skypack.dev/radix3@0.1.0?dts";

export type HttpMethod = "GET" | "POST" | "OPTIONS" | "DELETE" | "PUT";

export type HttpRequest = {
  conn: Deno.Conn;
  http: Deno.RequestEvent;
  pathParams: { [key: string]: unknown } | undefined;
  urlParams: string;
};
export type HttpResponse = { body?: BodyInit | null; init?: ResponseInit };

export type HttpAction = {
  target: { [key: string]: any };
  property: string;
  before: Array<(request: HttpRequest) => Promise<HttpRequest>>;
  decorators: Array<
    (target: any, property: string, descriptor: PropertyDescriptor) => void
  >;
  after: Array<(response: HttpResponse) => Promise<HttpResponse>>;
  promise: (request: HttpRequest) => Promise<HttpResponse>;
};

export class HttpRouter {
  readonly routes = new Array<
    { method: HttpMethod; path: string; action: HttpAction }
  >();

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
        before: [],
        decorators: [],
        after: [],
        promise: undefined!,
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
    route.method = method;
    route.path = path;
  }

  getRouter(targets: string[]) {
    const router = new Map</* method */ string, RadixRouter<HttpAction>>();
    for (const route of this.routes) {
      if (targets.indexOf(route.action.target.constructor.name) > -1) {
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