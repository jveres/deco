// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

export type HttpMethod = "GET" | "POST" | "OPTIONS" | "DELETE" | "PUT";
export type HttpResponse = { body?: BodyInit | null; init?: ResponseInit };
export interface HttpRoute {
  pattern: string | URLPattern;
  test(path: string): (() => boolean);
}

/*
if (isStatic) {
          return function () {
            return pathname === path;
          };
        } else {
          const pattern = new URLPattern({ pathname: path });
          console.log(pattern)
          return function () {
            return pattern.test({ pathname: pathname });
          };
        }
      },
*/

export class HttpRouter {
  #routes = new Map</*method*/ string, Array<HttpRoute>>();

  add({ method, path }: {
    method: HttpMethod;
    path: string;
  }) {
    const map = this.#routes.get(method) ?? new Array<HttpRoute>();
    const isStatic = !(path.includes(":") || path.includes("*"));
    const pattern = isStatic ? path : new URLPattern({ pathname: path });
    const test = isStatic
      ? eval(`(function(path) { return path === this.pattern })`)
      : eval(
        `(function(path) { return this.pattern.test({ pathname: path }) })`,
      );
    const route: HttpRoute = { pattern, test };
    map.push(route);
    this.#routes.set(method, map);
  }

  find(method: string, path: string) {
    return this.#routes.get(method)?.find((route) => route.test(path));
  }
}
