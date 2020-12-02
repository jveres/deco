# deco (WIP)
Decorators for Deno

### Running example

`deno run example.ts`


### Running tests

`deno test`

### Usage examples

```typescript
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

  @RateLimit({ rps: 5 })
  @Trace()
  async ratelimitTestMethod(): Promise<void> {
    await sleep(1000);
  }
}

// main entry

const example = new Example();

for (let i = 0; i < 10; i++) {
  example.ratelimitTestMethod()
    .catch((e: unknown) => {
      if (e instanceof RateLimitError) {
        console.log("Error: rate limited");
      }
    });
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

```