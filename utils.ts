import denque from "https://cdn.skypack.dev/pin/denque@v2.0.1-7VAkuu7E2GCqj7vx07sb/mode=imports,min/optimized/denque.js";
import _throttle from "https://cdn.skypack.dev/pin/lodash.throttle@v4.1.1-F50y3ZtJgnO9CirUfqrt/mode=imports,min/optimized/lodash.throttle.js";
import _debounce from "https://cdn.skypack.dev/pin/lodash.debounce@v4.0.8-aOLIwnE2RethWPrEzTeR/mode=imports,min/optimized/lodash.debounce.js";

export const Denque = denque as any;
export const throttle = _throttle as any;
export const debounce = _debounce as any;

export const sleep = (wait: number) =>
  new Promise((resolve) => setTimeout(resolve, wait));

export const DEFAULT_MAX_LRUCACHE_ENTRIES = 500;

export class LruCache<T> {
  private values: Map<string, T> = new Map<string, T>();
  private maxEntries: number;

  constructor(maxEntries: number = DEFAULT_MAX_LRUCACHE_ENTRIES) {
    this.maxEntries = maxEntries;
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
    if (this.values.size >= this.maxEntries) {
      const keyToDelete = this.values.keys().next().value;
      this.values.delete(keyToDelete);
    }
    this.values.set(key, value);
  }
}
