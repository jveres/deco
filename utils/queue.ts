// Copyright 2022 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

export class Queue<T> {
  #limit = 0;
  #list: Array<T>;

  constructor(
    /** The length after which the queue becomes circular, i.e., discards oldest items. */
    { limit = 0 } = {},
  ) {
    this.#limit = limit;
    this.#list = new Array<T>(limit);
  }
  /**
   * Add an item to the end of the queue.
   */
  enqueue(value: T): void {
    if (this.#limit > 0 && this.#list.length === this.#limit) {
      // Discard oldest item
      this.#list.shift();
    }
    this.#list.push(value);
  }
  /**
   * Return the oldest item from the queue.
   */
  dequeue() {
    return this.#list.shift();
  }

  get length() {
    return this.#list.length;
  }

  get head() {
    return this.#list[0];
  }

  clear(): void {
    this.#list = [];
  }

  forEach(f: (value: T) => void): void {
    this.#list.forEach(f);
  }
}
