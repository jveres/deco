// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import _Router from "https://cdn.skypack.dev/pin/@medley/router@v0.2.1-qsgLRjFoTcfu62jOFf5l/mode=imports,min/optimized/@medley/router.js";

export type HttpMethod = "GET" | "POST" | "OPTIONS";
export type HttpResponse = { body: string; init?: ResponseInit };
export type HttpFunction = (params?: any) => HttpResponse | Promise<HttpResponse>;

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
    handler: HttpFunction,
    upsert: boolean = true,
  ) {
    const store = this.#router.register(pathname);
    upsert ? store[method] = handler : store[method] ??= handler;
  }

  find(method: string, pathname: string) {
    const res = this.#router.find(pathname);
    return {
      handler: res?.store[method] || (() => {
        return HTTP_RESPONSE_405;
      }),
      params: res?.params,
    };
  }
}
