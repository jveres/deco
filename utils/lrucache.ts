// Copyright 2022 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

export const DEFAULT_LRUCACHE_MAX_SIZE = 500;

export class LruCache<T> {
  private values = new Map<string, T>();

  constructor(private readonly maxSize: number = DEFAULT_LRUCACHE_MAX_SIZE) {
  }

  public get(key: string): T | undefined {
    const entry: T | undefined = this.values.get(key);
    if (entry !== undefined) {
      this.values.delete(key);
      this.values.set(key, entry);
    }
    return entry;
  }

  public has(key: string): boolean {
    return this.values.has(key);
  }

  public put(key: string, value: T) {
    if (this.values.size >= this.maxSize) {
      const keyToDelete = this.values.keys().next().value;
      this.values.delete(keyToDelete);
    }
    this.values.set(key, value);
  }

  get size() {
    return this.values.size;
  }
}
