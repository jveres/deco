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
    const originalFn: Function = descriptor.value as Function;
    const cache = new LruCache<any>();
    let timeout = Number.POSITIVE_INFINITY;

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
        if (options.ttl) timeout = Date.now() + options.ttl;
        return result;
      }
    };

    return descriptor;
  };
}
