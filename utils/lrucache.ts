/**
 * Copyright 2022 Janos Veres. All rights reserved.
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file.
 */

export const DEFAULT_LRUCACHE_LIMIT = 100;

export class LruCache<T> {
  #limit = 0;
  #values: Map<string, T>;

  /**
   * Create a circular queue.
   * @param limit The limit after which the queue becomes circular, i.e. discards least recently used items.
   */
  constructor({ limit = DEFAULT_LRUCACHE_LIMIT } = {}) {
    this.#limit = limit;
    this.#values = new Map<string, T>();
  }

  /**
   * Get an item to the end of the queue.
   */
  public get(key: string): T | undefined {
    const entry: T | undefined = this.#values.get(key);
    if (entry !== undefined) {
      this.#values.delete(key);
      this.#values.set(key, entry);
    }
    return entry;
  }

  /**
   * Check if the queue contains item with @param key
   */
  public has(key: string): boolean {
    return this.#values.has(key);
  }

  /**
   * Add an item to the end of the queue.
   */
  public put(key: string, value: T) {
    if (this.#values.size >= this.#limit) {
      const keyToDelete = this.#values.keys().next().value;
      this.#values.delete(keyToDelete);
    }
    this.#values.set(key, value);
  }

  /**
   * Return the current length of the queue.
   */
  get size() {
    return this.#values.size;
  }
}
