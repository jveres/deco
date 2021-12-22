// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../../decorators/httpserver.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.119.0/testing/asserts.ts";
import {sleep } from "../../utils/utils.ts";

const port = 8090;

Deno.test({
  name: "@HttpServer methods",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    class ServerController {
      @HttpServer.Get("/get1")
      get() {}
      @HttpServer.Get()
      get2() {}

      @HttpServer.Post("/post1")
      post() {}
      @HttpServer.Post()
      post2() {}

      @HttpServer.Put("/put1")
      put() {}
      @HttpServer.Put()
      put2() {}

      @HttpServer.Delete("/delete1")
      delete() {}
      @HttpServer.Delete()
      delete2() {}

      @HttpServer.Options("/options1")
      options() {}
      @HttpServer.Options()
      options2() {}
    }
    const controller = new AbortController();
    HttpServer.serve({
      port,
      abortSignal: controller.signal,
      controllers: [ServerController],
    });
    let resp;
    await t.step("GET", async () => {
      resp = await fetch(`http://localhost:${port}/get1`);
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/get2`);
      assertEquals(resp.status, 200);
    });
    await t.step("POST", async () => {
      resp = await fetch(`http://localhost:${port}/post1`, { method: "POST" });
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/post2`, { method: "POST" });
      assertEquals(resp.status, 200);
    });
    await t.step("PUT", async () => {
      resp = await fetch(`http://localhost:${port}/put1`, { method: "PUT" });
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/put2`, { method: "PUT" });
      assertEquals(resp.status, 200);
    });
    await t.step("DELETE", async () => {
      resp = await fetch(`http://localhost:${port}/delete1`, {
        method: "DELETE",
      });
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/delete2`, {
        method: "DELETE",
      });
      assertEquals(resp.status, 200);
    });
    await t.step("OPTIONS", async () => {
      resp = await fetch(`http://localhost:${port}/options1`, {
        method: "OPTIONS",
      });
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/options2`, {
        method: "OPTIONS",
      });
      assertEquals(resp.status, 200);
    });
    controller.abort();
    await sleep(100);
  },
});

Deno.test({
  name: "@HttpServer hooks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    class ServerController {
      @HttpServer.Get()
      @HttpServer.Before((request) => {
        Object.assign(request, { test: "test before" });
        return Promise.resolve(request);
      })
      before({ test }: { test: string }) {
        return { body: test };
      }

      @HttpServer.Get()
      @HttpServer.After((request) => {
        request.body += " after";
        return Promise.resolve(request);
      })
      after() {
        return { body: "test" };
      }
    }
    const controller = new AbortController();
    HttpServer.serve({
      port,
      abortSignal: controller.signal,
      controllers: [ServerController],
    });
    let resp;
    await t.step("Before", async () => {
      resp = await fetch(`http://localhost:${port}/before`);
      assertEquals(resp.status, 200);
      assertEquals(await resp.text(), "test before");
    });
    await t.step("After", async () => {
      resp = await fetch(`http://localhost:${port}/after`);
      assertEquals(resp.status, 200);
      assertEquals(await resp.text(), "test after");
    });
    controller.abort();
    await sleep(100);
  },
});

Deno.test({
  name: "@HttpServer events",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const body = "Welcome to Deco!";
    class ServerController {
      @HttpServer.Get()
      home() {
        return { body };
      }
    }
    const controller = new AbortController();
    let started = false;
    let error = false;
    let closed = false;
    HttpServer.serve({
      port,
      abortSignal: controller.signal,
      controllers: [ServerController],
      onStarted: () => { started = true },
      onError: () => { error = true },
      onClosed: () => { closed = true }
    });
    const resp = await fetch(`http://localhost:${port}/home`);
    assertEquals(resp.status, 200);
    assertEquals(await resp.text(), body);
    controller.abort();
    await sleep(100);
    assertEquals(started, true);
    assertEquals(error, false);
    assertEquals(closed, true);
  },
});
