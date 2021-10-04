// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

export type HttpMethod = "GET" | "POST";
export type HttpResponse = { body: string; init?: ResponseInit };
export type HttpFunction = (params?: Object) => HttpResponse;

const NOT_ALLOWED_RESPONSE: HttpResponse = {
  body: "",
  init: { status: 405 },
};

interface Node {
  pattern: URLPattern;
  pathname: string;
  handler: HttpFunction;
}

interface Routes {
  [id: string]: Node[];
}

export class Router {
  private methods: Routes = {};

  add(method: HttpMethod, pathname: string, handler: HttpFunction) {
    if (!this.methods[method]) {
      this.methods[method] = [];
    } else {
      for (const node of this.methods[method]) {
        if (node.pathname === pathname) {
          node.handler = handler;
          return;
        }
      }
    }
    this.methods[method].push({
      pattern: new URLPattern({ pathname }),
      pathname,
      handler,
    });
  }

  find(method: string, pathname: string) {
    for (const node of this.methods[method]) {
      if (node.pattern.test(pathname)) {
        return {
          handler: node.handler,
          params: {}, // TODO: pattern.exec(...)
        };
      }
    }
    return {
      handler: (() => {
        return NOT_ALLOWED_RESPONSE;
      }),
    };
  }
}
