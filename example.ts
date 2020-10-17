import { Timeout, Trace, Retry, BackOffPolicy, sleep } from "./mod.ts";

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
  static async noDelayRetry(): Promise<void> {
    console.info(`Calling noDelayRetry for the ${count++} time at ${new Date().toLocaleTimeString()}`);
    throw new Error('I failed!');
  }

  @Retry({
    maxAttempts: 3,
    backOff: 1000,
    doRetry: (e: Error) => {
      return e.message === 'Error: 429';
    },
  })
  static async doRetry(): Promise<void> {
    console.info(`Calling doRetry for the ${count++} time at ${new Date().toLocaleTimeString()}`);
    throw new Error('Error: 429');
  }

  @Retry({
    maxAttempts: 3,
    backOff: 1000,
    doRetry: (e: Error) => {
      return e.message === 'Error: 429';
    },
  })
  static async doNotRetry(): Promise<void> {
    console.info(`Calling doNotRetry for the ${count++} time at ${new Date().toLocaleTimeString()}`);
    throw new Error('Error: 404');
  }

  @Retry({
    maxAttempts: 3,
    backOffPolicy: BackOffPolicy.FixedBackOffPolicy,
    backOff: 1000,
  })
  static async fixedBackOffRetry(): Promise<void> {
    console.info(`Calling fixedBackOffRetry 1s for the ${count++} time at ${new Date().toLocaleTimeString()}`);
    throw new Error('I failed!');
  }

  @Retry({
    maxAttempts: 3,
    backOffPolicy: BackOffPolicy.ExponentialBackOffPolicy,
    backOff: 1000,
    exponentialOption: { maxInterval: 4000, multiplier: 3 },
  })
  static async ExponentialBackOffRetry(): Promise<void> {
    console.info(`Calling ExponentialBackOffRetry backOff 1s, multiplier=3 for the ${count++} time at ${new Date().toLocaleTimeString()}`);
    throw new Error('I failed!');
  }
}

try {
  await Example.timeoutTestStatic();
} catch (e) {
  console.error(e);
}

let count = 1;
const resetCount = () => count = 1;

try {
  Example.traceTestStaticFunction();
  await new Example().timeoutTestMethod();
} catch (e) {
  console.error(e);
}

try {
  resetCount();
  await Example.noDelayRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}

try {
  resetCount();
  await Example.doRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}

try {
  resetCount();
  await Example.doNotRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}

try {
  resetCount();
  await Example.fixedBackOffRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}

try {
  resetCount();
  await Example.ExponentialBackOffRetry();
} catch (e) {
  console.info(`All retry done as expected, final message: '${e.message}'`);
}