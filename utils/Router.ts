// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file ban-types no-explicit-any

export type HttpMethod = "GET" | "POST" | "OPTIONS" | "DELETE" | "PUT";
export type HttpResponse = { body?: BodyInit | null; init?: ResponseInit };
export interface HttpRoute {
  target: { [key: string]: any };
  property: string;
  pattern: string | URLPattern;
  test(path: string): boolean;
}

function staticRouteTester(this: HttpRoute, path: string) {
  return path === this.pattern;
}

function dynamicRouteTester(this: HttpRoute, path: string) {
  return (this.pattern as URLPattern).test({ pathname: path });
}

const DEFAULT_HTTP_RESPONSES = {
  Ok() {
    return { init: { status: 200 } };
  },
  NotFound() {
    return { init: { status: 404 } };
  },
};

const ROUTE_404 = {
  target: DEFAULT_HTTP_RESPONSES,
  property: "NotFound",
  pattern: undefined!,
  test: undefined!,
};

export class HttpRouter {
  #routes = new Map</*method*/ string, Array<HttpRoute>>();

  add({ method, path, target, property }: {
    method: HttpMethod;
    path: string;
    target: Object;
    property: string;
  }) {
    const map = this.#routes.get(method) ?? new Array<HttpRoute>();
    const isStatic = !(path.includes(":") || path.includes("*"));
    target ??= DEFAULT_HTTP_RESPONSES;
    property ??= "Ok";
    const route: HttpRoute = {
      target,
      property,
      pattern: isStatic ? path : new URLPattern({ pathname: path }),
      test: undefined!, // lol
    };
    route.test = isStatic
      ? staticRouteTester.bind(route)
      : dynamicRouteTester.bind(route);
    map.push(route);
    this.#routes.set(method, map);
  }

  find(method: string, path: string) {
    return this.#routes.get(method)?.find((route) => route.test(path)) ||
      ROUTE_404;
  }
}
