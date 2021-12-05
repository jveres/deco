// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { createRouter } from "https://cdn.skypack.dev/radix3@0.1.0?min";

export type HttpMethod = "GET" | "POST" | "OPTIONS" | "DELETE" | "PUT";
export type HttpResponse = { body?: BodyInit | null; init?: ResponseInit };
export type HttpAction = {
  target: { [key: string]: any };
  property: string;
  promise: (...args: any[]) => Promise<HttpResponse>;
};

export interface HttpRoute {
  action: HttpAction;
  pattern: string | URLPattern;
  test(path: string): boolean;
}

export class HttpRouter {
  readonly routes: { [key: string]: any } = {};
  readonly actions = new Array<HttpAction>();

  add({ method, path, target, property }: {
    method: HttpMethod;
    path: string;
    target: { [key: string]: any };
    property: string;
  }) {
    if (!this.routes[method]) this.routes[method] = createRouter();
    const action: any = {
      target,
      property,
    };
    action.promise = (...args: any[]) => {
      return Promise.resolve(
        action.target[action.property](args),
      );
    };
    this.actions.push(action);
    this.routes[method].insert(path, action);
  }

  find(method: string, path: string) {
    return (this.routes[method]?.lookup(path) as HttpAction)?.promise;
  }
}
