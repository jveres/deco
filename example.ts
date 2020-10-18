import { BackOffPolicy, Memoize, Retry, sleep, Timeout, Trace } from "./mod.ts";

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
  static async noDelayRetry(): Promise<void> {
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
  static async doRetry(): Promise<void> {
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
  static async doNotRetry(): Promise<void> {
    throw new Error("Error: 404");
  }

  @Retry({
    maxAttempts: 3,
    backOffPolicy: BackOffPolicy.FixedBackOffPolicy,
    backOff: 1000,
  })
  @Trace()
  static async fixedBackOffRetry(): Promise<void> {
    throw new Error("I failed!");
  }

  @Retry({
    maxAttempts: 3,
    backOffPolicy: BackOffPolicy.ExponentialBackOffPolicy,
    backOff: 1000,
    exponentialOption: { maxInterval: 4000, multiplier: 3 },
  })
  @Trace()
  static async ExponentialBackOffRetry(): Promise<void> {
    throw new Error("I failed!");
  }

  private i: number = 0;

  @Memoize()
  @Trace()
  async testMemoize() {
    return ++this.i;
  }
}

// main entry

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

const example = new Example();
for (let i = 0; i < 3; i++) {
  console.log(`example.testMemoize() returns: ${await example.testMemoize()}`);
}
