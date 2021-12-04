// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export type HttpMethod = "GET" | "POST" | "OPTIONS" | "DELETE" | "PUT";
export type HttpResponse = { body?: BodyInit | null; init?: ResponseInit };
export type HttpAction = {
  target: any;
  property: string;
  promise: (...args: any[]) => Promise<HttpResponse>;
};

export interface HttpRoute {
  action: HttpAction;
  pattern: string | URLPattern;
  test(path: string): boolean;
}

function staticRouteTester(this: HttpRoute, path: string) {
  return path === this.pattern;
}

function dynamicRouteTester(this: HttpRoute, path: string) {
  return (this.pattern as URLPattern).test({ pathname: path });
}

export class HttpRouter {
  readonly routes = new Map</*method*/ string, Array<HttpRoute>>();

  add({ method, path, action }: {
    method: HttpMethod;
    path: string;
    action: HttpAction;
  }) {
    const map = this.routes.get(method) ?? new Array<HttpRoute>();
    const isStatic = !(path.includes(":") || path.includes("*"));
    const route: HttpRoute = {
      action,
      pattern: isStatic ? path : new URLPattern({ pathname: path }),
      test: undefined!,
    };
    route.test = isStatic
      ? staticRouteTester.bind(route)
      : dynamicRouteTester.bind(route);
    map.push(route);
    this.routes.set(method, map);
  }

  find(method: string, path: string) {
    return this.routes.get(method)?.find((route) => route.test(path))?.action.promise;
  }
}
