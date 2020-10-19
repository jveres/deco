import { LruCache } from "./utils.ts";

interface MemoizeOptions {
  resolver?: (...args: any[]) => string;
  ttl?: number;
  onAdded?: (key: string, value: any) => void;
  onFound?: (key: string, value: any) => void;
}

export function Memoize(options: MemoizeOptions = {}) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const timeout = options.ttl
      ? Date.now() + options.ttl
      : Number.POSITIVE_INFINITY;
    const originalFn: Function = descriptor.value as Function;
    const cache = new LruCache<any>();

    descriptor.value = async function (...args: any[]) {
      const key = options.resolver
        ? options.resolver.apply(this, args)
        : JSON.stringify(args);

      if (cache.has(key) && (!options.ttl || timeout > Date.now())) {
        const value: any = cache.get(key);
        options.onFound?.apply(this, [key, value]);
        return value;
      } else {
        const result = await originalFn.apply(this, args);
        cache.put(key, result);
        options.onAdded?.apply(this, [key, result]);
        return result;
      }
    };

    return descriptor;
  };
}
