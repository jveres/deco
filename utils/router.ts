// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import {
  createRouter,
  RadixRouter,
} from "https://cdn.skypack.dev/radix3@0.1.0?dts";

export type HttpMethod = "GET" | "POST" | "OPTIONS" | "DELETE" | "PUT";

export type HttpRequest = {
  conn: Deno.Conn;
  http: Deno.RequestEvent;
  pathParams: { [key: string]: unknown } | undefined;
  urlParams: string;
};
export type HttpResponse = { body?: BodyInit | null; init?: ResponseInit };

export type HttpAction = {
  target: { [key: string]: any };
  property: string;
  before: Array<(request: HttpRequest) => Promise<HttpRequest | Error>>;
  decorators: Array<
    (target: any, property: string, descriptor: PropertyDescriptor) => void
  >;
  after: Array<(response: HttpResponse) => Promise<HttpResponse>>;
  promise: (request: HttpRequest) => Promise<HttpResponse>;
};

export class HttpRouter {
  readonly routes = new Map</* method */ string, RadixRouter<HttpAction>>();
  readonly actions = new Array<HttpAction>();

  createAction(
    { target, property }: {
      target: any;
      property: string;
    },
  ) {
    const action = this.actions.find((action) =>
      action.target === target && action.property === property
    );
    if (action === undefined) {
      const action: HttpAction = {
        target,
        property,
        before: [],
        decorators: [],
        after: [],
        promise: undefined!,
      };
      this.actions.push(action);
      return action;
    } else {
      return action;
    }
  }

  add({ method, path, target, property }: {
    method: HttpMethod;
    path: string;
    target: { [key: string]: any };
    property: string;
  }) {
    if (!this.routes.has(method)) this.routes.set(method, createRouter());
    this.routes.get(method)!.insert(
      path,
      this.createAction({ target, property }),
    );
  }

  slice(target: string) {
    const res = new Map</* method */ string, any>();
    for (const [method, router] of this.routes) {
      if (!res.has(method)) res.set(method, createRouter());
    }
  }

  find(method: string, path: string) {
    return this.routes.get(method)?.lookup(path);
  }

  clear() {
    this.actions.length = 0;
    this.routes.clear();
  }
}
