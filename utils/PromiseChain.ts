// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

export type PromiseFn = ({ request }: { request: Request }) => Promise<any>;

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

  promise({ request }: { request: Request }) {
    return this.chain.reduce(
      (promise, next) => {
        return promise.then(next);
      },
      Promise.resolve({ request }),
    );
  }
}
