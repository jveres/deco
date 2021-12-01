// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import denque from "https://cdn.skypack.dev/pin/denque@v2.0.1-7VAkuu7E2GCqj7vx07sb/mode=imports,min/optimized/denque.js";
import _throttle from "https://cdn.skypack.dev/pin/lodash.throttle@v4.1.1-F50y3ZtJgnO9CirUfqrt/mode=imports,min/optimized/lodash.throttle.js";
import _debounce from "https://cdn.skypack.dev/pin/lodash.debounce@v4.0.8-aOLIwnE2RethWPrEzTeR/mode=imports,min/optimized/lodash.debounce.js";

export const Denque = denque as any;
export const throttle = _throttle as any;
export const debounce = _debounce as any;

export const IsAsyncFunction = (fn: any) =>
  fn.constructor.name === "AsyncFunction";

export const sleep = (wait: number) =>
  new Promise((resolve) => setTimeout(resolve, wait));

export const stringFromPropertyKey = (s: PropertyKey) =>
  typeof s === "symbol" ? (s.description || s.toString()) : String(s);

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

// Save original console log functions as globals
const { "log": _log, "info": _info, "warn": _warn, "error": _error } = console;

export interface ConsoleLogHookOptions {
  logPrefix?: string;
  infoPrefix?: string;
  warnPrefix?: string;
  errorPrefix?: string;
}

export function consoleLogHook(options: ConsoleLogHookOptions) {
  if (options.logPrefix) {
    console.log = function () {
      _log.apply(console, [
        options.logPrefix,
        ...arguments,
      ]);
    };
  }

  if (options.infoPrefix) {
    console.info = function () {
      _info.apply(console, [
        options.infoPrefix,
        ...arguments,
      ]);
    };
  }

  if (options.warnPrefix) {
    console.warn = function () {
      _warn.apply(console, [
        options.warnPrefix,
        ...arguments,
      ]);
    };
  }

  if (options.errorPrefix) {
    console.error = function () {
      _error.apply(console, [
        options.errorPrefix,
        ...arguments,
      ]);
    };
  }
}
