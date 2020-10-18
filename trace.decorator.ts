import * as Colors from "https://deno.land/std@0.74.0/fmt/colors.ts";

interface TraceOptions {
  stack?: boolean;
}

export function Trace(options: TraceOptions = { stack: false }) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn: Function = descriptor.value as Function;
    descriptor.value = async function (...args: any[]) {
      const e = new Error();
      Error.captureStackTrace(e, options.stack ? undefined : descriptor.value);
      const from = options.stack
        ? "\n" + e.stack?.split("\n").slice(1).join("\n")
        : e.stack?.split("\n").slice(1)[0].replace("at", "").trim();
      const p1 = performance.now();
      console.info(`${
        Colors.brightMagenta(
          propertyKey +
            "(…)",
        )
      } ${Colors.bold("called")} ${options.stack ? "" : "from"} ${
        Colors.brightCyan(from ?? "n/a")
      } at ${Colors.bold(new Date().toISOString())}`);
      let result;
      originalFn.constructor.name === "AsyncFunction"
        ? result = await originalFn.apply(this, args)
        : result = originalFn.apply(this, args);
      console.info(`${
        Colors.brightMagenta(
          propertyKey +
            "(…)",
        )
      } ${Colors.green("ended")} in ${
        Colors.brightYellow((performance.now() - p1).toFixed() + "ms")
      } at ${Colors.bold(new Date().toISOString())}`);
      return result;
    };
    return descriptor;
  };
}
