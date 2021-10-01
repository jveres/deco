// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// Based on https://github.com/steambap/koa-tree-router

import Node from "../utils/tree.js";

export type HttpMethod = "GET" | "POST";
export type HttpResponse = { body: string; status?: number };
export type HttpFunction = (params: Object) => HttpResponse;

const NOT_ALLOWED_RESPONSE: HttpResponse = {
  body: "method not allowed",
  "status": 405,
};

export class Router {
  private methods = {} as { [id: string]: Node };

  add(method: HttpMethod, path: string, handler: HttpFunction) {
    if (!this.methods[method]) this.methods[method] = new Node();
    this.methods[method].addRoute(path, handler);
  }

  find(method: string, path: string) {
    const node = this.methods[method];
    const res = node?.search(path);
    return {
      handle: res?.handle as HttpFunction || (() => {
        return NOT_ALLOWED_RESPONSE;
      }),
      params: res?.params,
    };
  }
}
