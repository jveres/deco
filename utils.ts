export const AsyncFunction =
  Object.getPrototypeOf(async function () {}).constructor;

export const sleep: Function = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
