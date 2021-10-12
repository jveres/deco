// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { RateLimitError } from "../decorators/ratelimit.decorator.ts";
import {
  BackOffPolicy,
  Concurrency,
  Memoize,
  RateLimit,
  Retry,
  sleep,
  Timeout,
  Trace,
  Try,
} from "../mod.ts";

class Example {
  @Trace()
  @Timeout(1000)
  static async timeoutTestStatic(): Promise<void> {
    await sleep(2000);
  }

  @Trace()
  static traceTestStaticFunction(): void {
    console.info("testing...");
  }

  @Trace({ stack: true })
  @Timeout(3000)
  async timeoutTestMethod(): Promise<void> {
    await sleep(2000);
  }

  @Retry({ maxAttempts: 3 })
  @Trace()
  static noDelayRetry() {
    throw new Error("I failed!");
  }

  @Retry({
    maxAttempts: 3,
    backOff: 1000,
    doRetry: (e: Error) => {
      return e.message === "Error: 429";
    },
  })
  @Trace()
  static doRetry() {
    throw new Error("Error: 429");
  }

  @Retry({
    maxAttempts: 3,
    backOff: 1000,
    doRetry: (e: Error) => {
      return e.message === "Error: 429";
    },
  })
  @Trace()
  static doNotRetry() {
    throw new Error("Error: 404");
  }

  @Retry({
    maxAttempts: 3,
    backOffPolicy: BackOffPolicy.FixedBackOffPolicy,
    backOff: 1000,
  })
  @Trace()
  static fixedBackOffRetry() {
    throw new Error("I failed!");
  }

  @Retry({
    maxAttempts: 3,
    backOffPolicy: BackOffPolicy.ExponentialBackOffPolicy,
    backOff: 1000,
    exponentialOption: { maxInterval: 4000, multiplier: 3 },
  })
  @Trace()
  static ExponentialBackOffRetry() {
    throw new Error("I failed!");
  }

  private i = 0;

  @Trace()
  @Memoize({
    ttl: 2000,
    resolver: (): string => {
      return "key";
    },
    onAdded: (key: string, value: any) => {
      console.log(`${key}=${value} added to cache`);
    },
    onFound: (key: string, value: any) => {
      console.log(`${key}=${value} found in cache`);
    },
  })
  async testMemoize() {
    await sleep(1000);
    return ++this.i;
  }

  @RateLimit()
  @Trace()
  async ratelimitTestMethod(): Promise<void> {
    await sleep(500);
  }

  @Try({
    catch: ["TypeError", "broken pipe error"],
    onError: (e) => {
      console.error("Error:", typeof e === "string" ? e : e.message);
    },
    onDone: () => {
      console.log("done");
    },
  })
  async tryCatchTest(flip: boolean): Promise<void> {
    if (flip) throw TypeError("type error");
    else throw "broken pipe error";
  }

  @Concurrency({
    max: 1,
    resolver: (wait: number) => {
      return `${wait}`;
    },
  })
  async concurrencyTest1(wait: number, throws = false) {
    if (throws) throw `Exception (${wait})`;
    console.info(`wait for ${wait}ms...`);
    await sleep(wait);
    return wait;
  }
}

// main entry

const example = new Example();

const promises = [];
for (let i = 0; i < 3; i++) {
  promises.push(
    example.concurrencyTest1((i + 1) * 1000).then((result) =>
      console.log(`result=${result}`)
    ).catch((err) => {
      console.error(`error=${err}`);
    }),
  );
}

await Promise.all(promises);

promises.splice(0, promises.length);

for (let i = 0; i < 5; i++) {
  promises.push(
    example.concurrencyTest1(1000).then((result) =>
      console.log(`result=${result}`)
    ).catch((err) => {
      console.error(`error=${err}`);
    }),
  );
}

await Promise.all(promises);

promises.splice(0, promises.length);

for (let i = 0; i < 5; i++) {
  promises.push(
    example.concurrencyTest1(1000, i > 0).then((result) =>
      console.log(`result=${result}`)
    ).catch((err) => {
      console.error(`error=${err}`);
    }),
  );
}

await Promise.all(promises);

await example.tryCatchTest(true);
await example.tryCatchTest(false);

for (let i = 0; i < 10; i++) {
  example.ratelimitTestMethod()
    .catch((e: unknown) => {
      if (e instanceof RateLimitError) console.log("rate limited");
    });
  await sleep(1);
}

for (let i = 0; i < 10; i++) {
  console.log(
    `(${i + 1}) example.testMemoize() returns: ${await example
      .testMemoize()}`,
  );
}

try {
  await Example.timeoutTestStatic();
} catch (e) {
  console.error(e);
}

try {
  Example.traceTestStaticFunction();
  await new Example().timeoutTestMethod();
} catch (e) {
  console.error(e);
}

try {
  await Example.noDelayRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}

try {
  await Example.doRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}

try {
  await Example.doNotRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}

try {
  await Example.fixedBackOffRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}

try {
  await Example.ExponentialBackOffRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}
