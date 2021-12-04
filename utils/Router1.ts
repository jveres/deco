// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { createRouter } from "https://esm.sh/radix3";

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

export class HttpRouter {
  readonly routes: { [key: string]: any } = {};
  readonly actions = new Array<HttpAction>();

  add({ method, path, action }: {
    method: HttpMethod;
    path: string;
    action: HttpAction;
  }) {
    if (!this.routes[method]) this.routes[method] = createRouter();
    this.actions.push(action);
    this.routes[method].insert(path, action);
  }

  find(method: string, path: string) {
    return (this.routes[method]?.lookup(path) as HttpAction)?.promise;
  }
}
