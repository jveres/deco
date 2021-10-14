// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import _Router from "https://cdn.skypack.dev/pin/@medley/router@v0.2.1-qsgLRjFoTcfu62jOFf5l/mode=imports,min/optimized/@medley/router.js";

export type HttpMethod = "GET" | "POST" | "OPTIONS";
export type HttpResponse = { body: string; init?: ResponseInit };
export type HttpFunction = (
  params?: any,
) => HttpResponse | Promise<HttpResponse>;
export type HttpAction = { handler: HttpFunction; target: Function | undefined };

export const HTTP_RESPONSE_200: HttpResponse = {
  body: "",
  init: { status: 200 },
};

export const HTTP_RESPONSE_405: HttpResponse = {
  body: "",
  init: { status: 405 },
};

export class Router {
  #router = new _Router();

  add(
    method: HttpMethod,
    pathname: string,
    action: HttpAction,
    upsert = true,
  ) {
    const store = this.#router.register(pathname);
    upsert ? store[method] = action : store[method] ??= action;
  }

  find(method: string, pathname: string) {
    const res = this.#router.find(pathname);
    return {
      action: res?.store[method] || { handler: (() => {
        return HTTP_RESPONSE_405;
      }), target: undefined},
      params: res?.params,
    };
  }
}
