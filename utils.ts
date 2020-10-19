export const sleep: Function = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class LruCache<T> {
  private values: Map<string, T> = new Map<string, T>();
  public maxEntries: number = 500;

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
