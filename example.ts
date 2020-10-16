import { Timeout, Trace } from "./mod.ts";

const sleep: Function = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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