// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.79.0/testing/asserts.ts";
import {
  Dequeue,
  LruCache,
  Quota,
  QuotaManager,
  rateLimit,
  sleep,
} from "../utils.ts";

Deno.test({
  name: "LruCache<T> with 501 numbers",
  fn() {
    const c = new LruCache<number>();
    for (let i = 1; i < 501; i++) {
      c.put(`${i}`, i);
    }
    assertEquals(c.get("1"), 1);
    c.put("501", 501);
    assertEquals(c.get("1"), 1);
    assertEquals(c.get("2"), undefined);
    assertEquals(c.has("501"), true);
  },
});

Deno.test({
  name: "Dequeue<string>",
  fn() {
    const d = new Dequeue<string>();
    assertEquals(d.length, 0);
    d.push("foo"); //  [ foo ]
    d.push("bar"); //  [ foo, bar ]
    assertEquals(d.length, 2);
    assertEquals(d.peekFront(), "foo");
    assertEquals(d.peekBack(), "bar");
    assertEquals(d.shift(), "foo"); // [ bar ]
    d.push("baz"); // [ bar, baz ]
    assertEquals(d.pop(), "baz"); // [ bar ]
    assertEquals(d.pop(), "bar"); // [ ]
    assertEquals(d.length, 0);
  },
});

Deno.test({
  name: "Dequeue<string> large size, unshift in, shift out",
  fn() {
    const TEST_SIZE = 1000000;
    const d1 = new Dequeue<number>();
    for (let i = 0; i < TEST_SIZE; ++i) {
      d1.unshift(i);
    }
    assertEquals(d1.length, TEST_SIZE);
    for (let i = 0; i < TEST_SIZE / 2; ++i) {
      d1.shift();
    }
    assertEquals(d1.length, TEST_SIZE - TEST_SIZE / 2);
    while (d1.length) d1.shift();
    assertEquals(d1.length, 0);
  },
});

Deno.test({
  name: "Dequeue<string> large size, push in, pop out",
  fn() {
    const TEST_SIZE = 1000000;
    const d1 = new Dequeue<number>();
    for (let i = 0; i < TEST_SIZE; ++i) {
      d1.push(i);
    }
    assertEquals(d1.length, TEST_SIZE);
    for (let i = 0; i < TEST_SIZE / 2; ++i) {
      d1.pop();
    }
    assertEquals(d1.length, TEST_SIZE - TEST_SIZE / 2);
    while (d1.length) d1.pop();
    assertEquals(d1.length, 0);
  },
});

Deno.test({
  name: "Dequeue<string>.clear()",
  fn() {
    const d = new Dequeue<string>();
    d.push("foo");
    d.push("bar");
    assertEquals(d.length > 0, true);
    d.clear();
    assertEquals(d.length, 0);
  },
});

Deno.test({
  name: "QuotaManager invocations",
  fn() {
    const quota: Quota = {
      rate: 3,
      interval: 500,
      concurrency: 2,
    };
    const qm = new QuotaManager(quota);
    assertEquals(qm.start(), true);
    assertEquals(qm.start(), true);
    assertEquals(qm.start(), false);
    qm.end();
    assertEquals(qm.start(), true);
    assertEquals(qm.activeCount, 2);
    assertEquals(qm.start(), false);
    assertEquals(qm.activeCount, 2);
    qm.end();
    assertEquals(qm.activeCount, 1);
    qm.end();
    assertEquals(qm.activeCount, 0);
  },
});

function mockApi(sleepTime: number) {
  const fn = async (err: Error | null = null): Promise<void> => {
    fn["runCount"]++;
    if (err) {
      fn["rejectCount"]++;
      throw err;
    }
    await sleep(sleepTime);
    fn["fulfillCount"]++;
  };

  fn["runCount"] = 0;
  fn["rejectCount"] = 0;
  fn["fulfillCount"] = 0;

  return fn;
}

Deno.test({
  name: "QuotaManager concurrency is enforced",
  async fn() {
    const quota: Quota = {
      concurrency: 2,
    };
    const limit = rateLimit(quota);
    const api = mockApi(500);
    const startTime = Date.now();
    const promises = [
      limit(() => api()), // 0-500 ms
      limit(() => api()), // 0-500 ms
      limit(() => api()), // 500-1000 ms
    ];

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        assertEquals(api["fulfillCount"], 0);
      } else if (elapsed > 600 && elapsed < 900) {
        assertEquals(api["fulfillCount"], 2);
      } else if (elapsed > 1200) {
        assertEquals(api["fulfillCount"], 3);
        break;
      }
      await sleep(200);
    }
  },
});

Deno.test({
  name: "QuotaManager rate limits are enforced",
  async fn() {
    const quota: Quota = { interval: 500, rate: 3 };
    const quotaManager = new QuotaManager(quota);
    const limit = rateLimit(quotaManager);
    const api = mockApi(500);
    const startTime = Date.now();
    const promises = [
      limit(() => api()), // 0-500 ms
      limit(() => api()), // 0-500 ms
      limit(() => api()), // 0-500 ms
      limit(() => api()), // 500-1000 ms
      limit(() => api()), // 500-1000 ms
    ];

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        assertEquals(quotaManager.activeCount, 3);
        assertEquals(api["fulfillCount"], 0);
      } else if (elapsed > 600 && elapsed < 900) {
        assertEquals(quotaManager.activeCount, 2);
        assertEquals(api["fulfillCount"], 3);
      } else if (elapsed > 1200) {
        assertEquals(quotaManager.activeCount, 0);
        assertEquals(api["fulfillCount"], 5);
        break;
      }
      await sleep(200);
    }
  },
});

Deno.test({
  name: "QuotaManager combined concurrency and rate limits are enforced",
  async fn() {
    const quota: Quota = { interval: 1000, rate: 3, concurrency: 2 };
    const quotaManager = new QuotaManager(quota);
    const limit = rateLimit(quotaManager);
    const api = mockApi(500);
    const startTime = Date.now();
    const promises = [
      limit(() => api()), // 0-500 ms
      limit(() => api()), // 0-500 ms
      limit(() => api()), // 500-1000ms
      limit(() => api()), // 1000-1500 ms
      limit(() => api()), // 1000-1500 ms
    ];

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        assertEquals(quotaManager.activeCount, 2);
        assertEquals(api["fulfillCount"], 0);
      } else if (elapsed > 600 && elapsed < 900) {
        assertEquals(quotaManager.activeCount, 1);
        assertEquals(api["fulfillCount"], 2);
      } else if (elapsed > 1100 && elapsed < 1400) {
        assertEquals(quotaManager.activeCount, 2);
        assertEquals(api["fulfillCount"], 3);
      } else if (elapsed > 1700) {
        assertEquals(quotaManager.activeCount, 0);
        assertEquals(api["fulfillCount"], 5);
        break;
      }
      await sleep(200);
    }
  },
});
