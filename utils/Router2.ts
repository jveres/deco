// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import _Router from "https://cdn.skypack.dev/pin/@medley/router@v0.2.1-qsgLRjFoTcfu62jOFf5l/mode=imports,min/optimized/@medley/router.js";

export type HttpMethod = "GET" | "POST";
export type HttpResponse = { body: string; init?: ResponseInit };
export type HttpFunction = (params?: Object) => HttpResponse;

const NOT_ALLOWED_RESPONSE: HttpResponse = {
  body: "",
  init: { status: 405 },
};

export class Router {
  #router = new _Router();

  add(method: HttpMethod, pathname: string, handler: HttpFunction) {
    const store = this.#router.register(pathname);
    store[method] = handler;
  }

  find(method: string, path: string) {
    const res = this.#router.find(path); 
    return {
      handler: res?.store[method] || (() => {
        return NOT_ALLOWED_RESPONSE;
      }),
      params: res?.store[method]?.params
    };
  }
}
