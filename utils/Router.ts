// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import _Router from "https://cdn.skypack.dev/pin/@medley/router@v0.2.1-qsgLRjFoTcfu62jOFf5l/mode=imports,min/optimized/@medley/router.js";

export type HttpMethod = "GET" | "POST" | "OPTIONS" | "DELETE" | "PUT";
export type HttpResponse = { body?: string; init?: ResponseInit };
export type HttpFunction = (
  params?: any,
) => HttpResponse | Promise<HttpResponse | void> | void;
export type HttpAction = { handler: HttpFunction; target?: Object };

export const HTTP_RESPONSE_200: HttpResponse = {
  init: { status: 200 },
};

export const HTTP_RESPONSE_405: HttpResponse = {
  init: { status: 405 },
};

export class Router {
  #router = new _Router();

  add({ method, path, action, upsert = true }: {
    method: HttpMethod;
    path: string;
    action: HttpAction;
    upsert?: boolean;
  }) {
    const store = this.#router.register(path);
    upsert ? store[method] = action : store[method] ??= action;
  }

  find(method: string, pathname: string) {
    const res = this.#router.find(pathname);
    return {
      action: res?.store[method] || {
        handler: (() => {
          return HTTP_RESPONSE_405;
        }),
      },
      params: res?.params,
    };
  }
}
