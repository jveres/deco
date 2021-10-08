// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { RoadRunner } from "https://cdn.skypack.dev/pin/@parisholley/road-runner@v1.1.8-WJu4tO4FoeGZz2fV94x7/mode=imports,min/optimized/@parisholley/road-runner.js";

export type HttpMethod = "GET" | "POST";
export type HttpResponse = { body: string; init?: ResponseInit };
export type HttpFunction = (params?: Object) => HttpResponse;

const NOT_ALLOWED_RESPONSE: HttpResponse = {
  body: "",
  init: { status: 405 },
};

export class Router {
  #router = new RoadRunner();

  add(method: HttpMethod, pathname: string, handler: HttpFunction) {
    this.#router.addRoute(method, pathname, handler);
  }

  find(method: string, path: string) {
    const res = this.#router.findRoute(method, path);
    return {
      handler: res?.value || (() => {
        return NOT_ALLOWED_RESPONSE;
      }),
      params: res?.params,
    };
  }
}
