// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { PathRegExp } from "https://cdn.skypack.dev/pin/@marvinh/path-to-regexp@v3.1.0-OidhulGbJu7mjRrLCRTz/mode=imports,min/optimized/@marvinh/path-to-regexp.js";

export type HttpMethod = "GET" | "POST";
export type HttpResponse = { body: string; init?: ResponseInit };
export type HttpFunction = (params?: Object) => HttpResponse;

const NOT_ALLOWED_RESPONSE: HttpResponse = {
  body: "",
  init: { status: 405 },
};

interface Route {
  regexp: any;
  handler: HttpFunction;
}

export class Router {
  private router = {} as { [key: string]: Route[] };

  add(
    method: HttpMethod,
    pathname: string,
    handler: HttpFunction,
    upsert: boolean = true,
  ) {
    if (!this.router[method]) this.router[method] = [];
    const route: Route = { regexp: new PathRegExp(pathname), handler };
    this.router[method].push(route);
  }

  find(method: string, pathname: string) {
    let match: any = null;
    const route = this.router[method].find((route) => match = route.regexp.match(pathname));
    return {
      handler: route?.handler || (() => {
        return NOT_ALLOWED_RESPONSE;
      }),
      params: match?.params ?? {},
    };
  }
}
