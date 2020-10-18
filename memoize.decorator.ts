import * as Colors from "https://deno.land/std@0.74.0/fmt/colors.ts";

interface MemoizeOptions {
  resolver?: (...args: any[]) => string | number;
  ttl?: number;
}

const memoizeMap = new Map();

export function Memoize(options: MemoizeOptions = {}) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>,
  ) {
    let timeout = Number.POSITIVE_INFINITY;
    const originalFn: Function = descriptor.value as Function;
    const map = new Map();

    descriptor.value = async function (...args: any[]) {
      const key = options.resolver
        ? options.resolver.apply(this, args)
        : JSON.stringify(args);

      if (map.has(key) && (!options.ttl || timeout > Date.now())) {
        return map.get(key);
      } else {
        const result = await originalFn.apply(this, args);
        map.set(key, result);
        if (options.ttl) timeout = Date.now() + options.ttl;
        return result;
      }
    };

    return descriptor;
  };
}
