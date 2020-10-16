import * as Colors from "https://deno.land/std/fmt/colors.ts";

const DEFAULT_TIMEOUT_MS = 10000;

export function Timeout(timeout: number = DEFAULT_TIMEOUT_MS) {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>,
  ) {
    const originalFn: Function = descriptor.value as Function;
    descriptor.value = async function (...args: any[]) {
      try {
        return await timeoutAsync.apply(
          this,
          [
            originalFn,
            args,
            timeout,
          ],
        );
      } catch (e) {
        if (e.message === "timeout") {
          e.message = `${
            Colors.bold("Timeout (" + String(timeout) + "ms")
          }) exceeded for ${
            Colors.brightMagenta(
              propertyKey +
                "(…)",
            )
          }`;
          Error.captureStackTrace(e, descriptor.value);
        }
        throw e;
      }
    };
    return descriptor;
  };
}

async function timeoutAsync(
  this: any,
  fn: Function,
  args: any[],
  timeout: number,
): Promise<any> {
  let id: number;
  return Promise.race([
    new Promise((_, reject) => {
      id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error("timeout"));
      }, timeout);
    }),
    fn.apply(this, args),
  ]).then((result) => {
    clearTimeout(id);
    return result;
  });
}
