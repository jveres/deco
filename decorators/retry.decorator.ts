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

export class RetryError extends Error {}

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
        attempts: number,
        backOff?: number,
        doRetry?: (e: any) => boolean,
      ): Promise<any> => {
        try {
          return await fn.apply(this, args);
        } catch (err: unknown) {
          if (--attempts < 0) {
            throw new RetryError(
              `${stringFromPropertyKey(propertyKey)}() failed ${
                maxAttempts + 1
              } times`,
              { cause: err },
            );
          } else if (doRetry && !doRetry(err)) {
            throw err;
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
            attempts,
            backOff,
            doRetry,
          ]);
        }
      };
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
    };
    return descriptor;
  };
