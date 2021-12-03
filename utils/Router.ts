// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

export type HttpMethod = "GET" | "POST" | "OPTIONS" | "DELETE" | "PUT";
export type HttpResponse = { body?: BodyInit | null; init?: ResponseInit };
export interface HttpRoute {
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
  #routes = new Map</*method*/ string, Array<HttpRoute>>();

  add({ method, path }: {
    method: HttpMethod;
    path: string;
  }) {
    const map = this.#routes.get(method) ?? new Array<HttpRoute>();
    const isStatic = !(path.includes(":") || path.includes("*"));
    const route: HttpRoute = {
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
    return this.#routes.get(method)?.find((route) => route.test(path));
  }
}
