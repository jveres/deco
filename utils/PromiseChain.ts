// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import type { HttpResponse } from "./Router.ts";

export type PromiseFn = (...args: any[]) => Promise<any>;

export class PromiseChain {
  private chain = new Array<PromiseFn>();

  constructor(promiseFn?: PromiseFn) {
    this.promise = this.promise.bind(this);
    if (promiseFn) this.append([promiseFn]);
  }

  append(promiseFn: PromiseFn[]) {
    this.chain = this.chain.concat(promiseFn);
  }

  prepend(promiseFn: PromiseFn[]) {
    this.chain = promiseFn.concat(this.chain);
  }

  promise() {
    return this.chain.reduce(
      function (promise, next) {
        return promise.then(next);
      },
      Promise.resolve({} as HttpResponse),
    );
  }
}
