// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any ban-types

import {
  AsyncMethodDecorator,
  AsyncTypedPropertyDescriptor,
  sleep,
  stringFromPropertyKey,
} from "../utils/utils.ts";

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BACKOFF_MS = 1000;
export const DEFAULT_MAX_EXPONENTIAL_INTERVAL_MS = 2000;
export const DEFAULT_EXPONENTIAL_MULTIPLIER = 2;

export enum BackOffPolicy {
  FixedBackOffPolicy = "FixedBackOffPolicy",
  ExponentialBackOffPolicy = "ExponentialBackOffPolicy",
}

export const Retry = (
  {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    backOffPolicy,
    backOff,
    doRetry,
    exponentialOption,
  }: {
    maxAttempts?: number;
    backOffPolicy?: BackOffPolicy;
    backOff?: number;
    doRetry?: (err: unknown) => boolean;
    exponentialOption?: { maxInterval: number; multiplier: number };
  } = {},
): AsyncMethodDecorator =>
  (
    _target: Object,
    propertyKey: string | symbol,
    descriptor: AsyncTypedPropertyDescriptor,
  ) => {
    const fn = descriptor.value!;
    if (backOffPolicy === BackOffPolicy.ExponentialBackOffPolicy) {
      backOff ??= DEFAULT_BACKOFF_MS;
      exponentialOption = {
        ...{
          maxInterval: DEFAULT_MAX_EXPONENTIAL_INTERVAL_MS,
          multiplier: DEFAULT_EXPONENTIAL_MULTIPLIER,
        },
        ...exponentialOption,
      };
    }
    descriptor.value = async function (...args: any[]) {
      const retryAsync = async (
        fn: (...args: any[]) => any,
        args: any[],
        maxAttempts: number,
        backOff?: number,
        doRetry?: (e: any) => boolean,
      ): Promise<any> => {
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
              backOffPolicy ===
                BackOffPolicy.ExponentialBackOffPolicy &&
              exponentialOption
            ) {
              const newBackOff: number = backOff *
                exponentialOption.multiplier;
              backOff = newBackOff > exponentialOption.maxInterval
                ? exponentialOption.maxInterval
                : newBackOff;
            }
          }
          return retryAsync.apply(this, [
            fn,
            args,
            maxAttempts,
            backOff,
            doRetry,
          ]);
        }
      };
      try {
        return await retryAsync.apply(
          this,
          [
            fn,
            args,
            maxAttempts,
            backOff,
            doRetry,
          ],
        );
      } catch (e) {
        if (e.message === "maxAttempts") {
          e.code = "429";
          e.message = `${
            stringFromPropertyKey(propertyKey)
          }() error, retry failed for ${maxAttempts} times.`;
        }
        throw e;
      }
    };
    return descriptor;
  };
