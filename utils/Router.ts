// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import $Router from "https://cdn.skypack.dev/pin/@medley/router@v0.2.1-qsgLRjFoTcfu62jOFf5l/mode=imports,min/optimized/@medley/router.js";

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
  readonly routes = new $Router();
  readonly actions = new Array<HttpAction>();

  add({ method, path, action, upsert = true }: {
    method: HttpMethod;
    path: string;
    action: HttpAction;
    upsert?: boolean;
  }) {
    this.actions.push(action);
    const store = this.routes.register(path);
    upsert ? store[method] = action : store[method] ??= action;
  }

  find(method: string, path: string) {
    return (this.routes.find(path)?.store[method] as HttpAction).promise;
  }
}
