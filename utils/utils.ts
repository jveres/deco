// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

export function sleep(wait: number, signal?: AbortSignal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, wait);
    signal?.addEventListener("abort", () => {
      if (id) clearTimeout(id);
      reject();
    });
  });
}

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

export function consoleLogHook(
  { logPrefix, infoPrefix, warnPrefix, errorPrefix }: {
    logPrefix?: string;
    infoPrefix?: string;
    warnPrefix?: string;
    errorPrefix?: string;
  },
) {
  if (logPrefix) {
    console.log = function () {
      _log.apply(console, [
        logPrefix,
        ...arguments,
      ]);
    };
  }

  if (infoPrefix) {
    console.info = function () {
      _info.apply(console, [
        infoPrefix,
        ...arguments,
      ]);
    };
  }

  if (warnPrefix) {
    console.warn = function () {
      _warn.apply(console, [
        warnPrefix,
        ...arguments,
      ]);
    };
  }

  if (errorPrefix) {
    console.error = function () {
      _error.apply(console, [
        errorPrefix,
        ...arguments,
      ]);
    };
  }
}
