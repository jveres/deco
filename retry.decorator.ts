import { sleep } from "./utils.ts";
import * as Colors from "https://deno.land/std@0.74.0/fmt/colors.ts";

const DEFAULT_BACKOFF_MS = 1000;
const DEFAULT_MAX_EXPONENTIAL_INTERVAL_MS = 2000;
const DEFAULT_EXPONENTIAL_MULTIPLIER = 2;

export interface RetryOptions {
  maxAttempts: number;
  backOffPolicy?: BackOffPolicy;
  backOff?: number;
  doRetry?: (e: any) => boolean;
  exponentialOption?: { maxInterval: number; multiplier: number };
}

export enum BackOffPolicy {
  FixedBackOffPolicy = "FixedBackOffPolicy",
  ExponentialBackOffPolicy = "ExponentialBackOffPolicy",
}

/**
 * retry decorator which is nothing but a high order function wrapper
 *
 * @param options the 'RetryOptions'
 */
export function Retry(options: RetryOptions) {
  /**
   * target: The prototype of the class (Object)
   * propertyKey: The name of the method (string | symbol).
   * descriptor: A TypedPropertyDescriptor — see the type, leveraging the Object.defineProperty under the hood.
   */
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalFn: Function = descriptor.value;
    // set default value for ExponentialBackOffPolicy
    if (options.backOffPolicy === BackOffPolicy.ExponentialBackOffPolicy) {
      !options.backOff && (options.backOff = DEFAULT_BACKOFF_MS);
      options.exponentialOption = {
        ...{ maxInterval: DEFAULT_MAX_EXPONENTIAL_INTERVAL_MS, multiplier: DEFAULT_EXPONENTIAL_MULTIPLIER },
        ...options.exponentialOption,
      };
    }
    descriptor.value = async function (...args: any[]) {
      try {
        return await retryAsync.apply(
          this,
          [
            originalFn,
            args,
            options.maxAttempts,
            options.backOff,
            options.doRetry,
          ],
        );
      } catch (e) {
        if (e.message === "maxAttempts") {
          e.code = "429";
          e.message = `${Colors.brightRed("Failed")} for ${
            Colors.brightMagenta(propertyKey + "(…)")
          } for ${Colors.brightYellow(options.maxAttempts.toString())} times.`;
        }
        throw e;
      }
    };
    return descriptor;
  };

  async function retryAsync(
    this: any,
    fn: Function,
    args: any[],
    maxAttempts: number,
    backOff?: number,
    doRetry?: (e: any) => boolean,
  ): Promise<any> {
    try {
      return await fn.apply(this, args);
    } catch (e) {
      if (--maxAttempts < 0) {
        console.error(e?.message);
        throw new Error("maxAttempts");
      } else if (doRetry && !doRetry(e)) {
        throw e;
      }
      if (backOff) {
        await sleep(backOff);
        if (
          options.backOffPolicy === BackOffPolicy.ExponentialBackOffPolicy &&
          options.exponentialOption
        ) {
          const newBackOff: number = backOff *
            options.exponentialOption.multiplier;
          backOff = newBackOff > options.exponentialOption.maxInterval
            ? options.exponentialOption.maxInterval
            : newBackOff;
        }
      }
      return retryAsync.apply(this, [fn, args, maxAttempts, backOff, doRetry]);
    }
  }
}
