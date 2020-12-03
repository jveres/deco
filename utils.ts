export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class LruCache<T> {
  private values: Map<string, T> = new Map<string, T>();
  public maxEntries = 500;

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

export class RateLimitError extends Error {}

interface Node<T> {
  value: T;
  prev: Node<T> | undefined;
  next: Node<T> | undefined;
}

export class Dequeue<T> {
  private _length = 0;
  private head: Node<T> | undefined = undefined;
  private tail: Node<T> | undefined = undefined;

  get length() {
    return this._length;
  }

  clear() {
    this.head = this.tail = undefined;
    this._length = 0;
  }

  push(value: T) {
    const newNode: Node<T> = {
      value,
      prev: this.tail,
      next: undefined,
    };

    if (this._length) {
      if (this.tail) this.tail.next = newNode;
      this.tail = newNode;
    } else {
      this.head = this.tail = newNode;
    }
    this._length++;
  }

  pop(): T | undefined {
    if (!this._length) {
      return undefined;
    }
    const result = this.tail;
    this.tail = this.tail?.prev;
    this._length--;
    if (!this._length) {
      this.head = this.tail = undefined;
    }
    return result?.value;
  }

  unshift(value: T) {
    const newNode: Node<T> = {
      value,
      prev: undefined,
      next: this.head,
    };

    if (this._length) {
      if (this.head) this.head.prev = newNode;
      this.head = newNode;
    } else {
      this.head = this.tail = newNode;
    }

    this._length++;
  }

  shift(): T | undefined {
    if (!this._length) return undefined;
    const result = this.head;
    this.head = this.head?.next;
    this._length--;
    if (!this._length) this.head = this.tail = undefined;
    return result?.value;
  }

  peekFront(): T | undefined {
    if (this._length) return this.head?.value;
    return undefined;
  }

  peekBack(): T | undefined {
    if (this._length) return this.tail?.value;
    return undefined;
  }
}

export interface Quota {
  /** interval (sliding window) over which API calls are counted, in milliseconds */
  interval?: number;
  /** number of API calls allowed per interval */
  rate?: number;
  /** number of concurrent API calls allowed */
  concurrency?: number;
  /**
   * if a request is queued longer than this, it will be discarded and an error thrown
   * (default: 0, disabled)
   */
  maxDelay?: number;
}

export const DEFAULT_QUOTA = {
  interval: 1000,
  rate: 1,
  concurrency: 1,
  maxDelay: 0,
};

export class QuotaManager {
  private _quota: Quota;
  private _activeCount = 0;
  private history = new Dequeue<any>();

  constructor(quota: Quota = DEFAULT_QUOTA) {
    this._quota = Object.assign(DEFAULT_QUOTA, quota);
  }

  get quota() {
    return this._quota;
  }

  get activeCount() {
    return this._activeCount;
  }

  get maxDelay() {
    return this._quota.maxDelay;
  }

  /**
   * Log that an invocation started.
   * @returns true if the invocation was allowed, false if not (you can try again later)
   */
  start() {
    if (
      this._quota.concurrency !== undefined &&
      this._activeCount >= this._quota.concurrency
    ) {
      return false;
    }

    if (this._quota.interval !== undefined && this._quota.rate !== undefined) {
      this.removeExpiredHistory();
      if (this.history.length >= this._quota.rate) return false;
      this.history.push(Date.now());
    }

    this._activeCount++;
    return true;
  }

  end() {
    this._activeCount--;
  }

  protected removeExpiredHistory() {
    if (this._quota.interval === undefined) return;
    const expired = Date.now() - this._quota.interval;
    while (this.history.length && (this.history.peekFront() < expired)) {
      this.history.shift();
    }
  }
}

export function rateLimit(
  quotaManager: QuotaManager | Quota,
): <T>(fn: () => Promise<T>) => Promise<T> {
  if (!(quotaManager instanceof QuotaManager)) {
    return rateLimit(new QuotaManager(quotaManager));
  }

  const queue = new Dequeue<Function>();
  let timerId: number | null = null;

  const next = () => {
    while (queue.length && quotaManager.start()) {
      const fn = queue.shift();
      if (fn) fn();
    }

    if (queue.length && !quotaManager.activeCount && !timerId) {
      timerId = setTimeout(() => {
        timerId = null;
        next();
      }, 100);
    }
  };

  return <T>(fn: () => Promise<T>) => {
    return new Promise<T>((resolve, reject) => {
      let timerId: number | null = null;
      if (quotaManager.maxDelay !== undefined) {
        timerId = setTimeout(() => {
          timerId = null;
          reject(new RateLimitError("Rate limit exceeded"));
          next();
        }, quotaManager.maxDelay);
      }

      const run = () => {
        console.log("run")
        if (quotaManager.maxDelay !== undefined) {
          if (timerId) {
            clearTimeout(timerId);
            timerId = null;
          } else {
            // timeout already fired
            quotaManager.end();
            return;
          }
        }

        fn()
          .then((val) => {
            resolve(val);
          })
          .catch((err) => {
            reject(err);
          })
          .then(() => {
            quotaManager.end();
            next();
          });
      };

      queue.push(run);
      next();
    });
  };
}
