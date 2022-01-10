// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { HttpServer } from "../../decorators/httpserver.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { sleep } from "../../utils/utils.ts";

const port = 8090;

Deno.test({
  name: "@HttpServer.serve(): default response codes (200, 404)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    class ServerController {
      @HttpServer.Get()
      home() {}
    }
    const controller = new AbortController();
    HttpServer.serve({
      port,
      abortSignal: controller.signal,
      controllers: [ServerController],
    });
    let resp = await fetch(`http://localhost:${port}/home`);
    assertEquals(resp.status, 200);
    resp = await fetch(`http://localhost:${port}/index`);
    assertEquals(resp.status, 404);
    controller.abort();
    await sleep(100);
  },
});

Deno.test({
  name: "@HttpServer.serve(): bad request",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    let e: any, o: any;
    class ServerController {
      @HttpServer.Get()
      home() {
        throw new Error();
      }
    }
    const controller = new AbortController();
    HttpServer.serve({
      port,
      abortSignal: controller.signal,
      controllers: [ServerController],
      onError: (err: unknown) => {
        e = err;
      },
      onStarted: async () => {
        const curl = Deno.run({
          cmd: [
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            `"%{http_code}`,
            `http://localhost:${port}/bad `,
          ],
          stdout: "piped",
        });
        o = await curl.output();
      },
    });
    await sleep(100);
    const status = new TextDecoder().decode(o);
    assertEquals(e?.message, "invalid HTTP version parsed");
    assertEquals(status, `"400`);
    controller.abort();
    await sleep(100);
  },
});

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
  name: "@HttpServer.Before(), @HttpServer.After()",
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
  name: "@HttpServer.Decorate()",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const test = "Hello from Decorator";
    const decorator = (
      _target: any,
      _property: string,
      desc: PropertyDescriptor,
    ) => {
      const fn = desc.value;
      desc.value = function (...args: any[]) {
        Object.assign(args[0], { test });
        return fn.apply(this, args);
      };
    };
    class ServerController {
      @HttpServer.Get()
      @HttpServer.Decorate([decorator])
      decorated({ test }: { test: string }) {
        return { body: test };
      }
    }
    const controller = new AbortController();
    HttpServer.serve({
      port,
      abortSignal: controller.signal,
      controllers: [ServerController],
    });
    const resp = await fetch(`http://localhost:${port}/decorated`);
    assertEquals(resp.status, 200);
    assertEquals(await resp.text(), test);
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
      onStarted: () => {
        started = true;
      },
      onError: () => {
        error = true;
      },
      onClosed: () => {
        closed = true;
      },
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

Deno.test({
  name: "@HttpServer.Auth()",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const authKey = await crypto.subtle.importKey(
      "jwk",
      {
        "crv": "P-256",
        "ext": true,
        "key_ops": [
          "verify",
        ],
        "kty": "EC",
        "x": "KTC6goa_8OdCDmcHGuBY2-uzf4pnXwfBYTZWGVsc_Ds",
        "y": "yw7t4hiNqyZPcbp-_ocy8_H1OBWw-FU-mfPRDS-Rdds",
      },
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["verify"],
    );
    class ServerController {
      @HttpServer.Get()
      @HttpServer.Auth({ authKey })
      auth({ payload }: { payload: Record<string, unknown> }) {
        return { body: JSON.stringify(payload) };
      }
    }
    const controller = new AbortController();
    HttpServer.serve({
      port,
      abortSignal: controller.signal,
      controllers: [ServerController],
    });
    const body = JSON.stringify({
      sub: "1234567890",
      name: "John Doe",
      admin: true,
      iat: 1516239022,
    });
    let resp = await fetch(`http://localhost:${port}/auth`);
    assertEquals(resp.status, 401);
    resp = await fetch(`http://localhost:${port}/auth`, {
      headers: {
        "x-access-token": "bogus jwt",
      },
    });
    assertEquals(resp.status, 403);
    resp = await fetch(`http://localhost:${port}/auth`, {
      headers: {
        "x-access-token":
          "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.AbTCrX_2fvEYk3e6IsNwtweMht6JLfma7i_PS-vzDvHZIQB3FldT80SFuIV7hje-GcCkYnQp22JJGHNOLgx4kw",
      },
    });
    assertEquals(resp.status, 200);
    assertEquals(await resp.text(), body);
    controller.abort();
    await sleep(100);
  },
});

Deno.test({
  name: "Request.abortWith(): aborting request chain",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    class ServerController {
      @HttpServer.Get()
      @HttpServer.Before((request) => {
        return request.http.abortWith(); // No error status
      })
      test1() {
        return { body: "This is never returned" };
      }

      @HttpServer.Get()
      @HttpServer.Before((request) => {
        return request.http.abortWith(Response.Status(403)); // Forbidden
      })
      test2() {
        return { body: "This is never returned" };
      }
    }
    const controller = new AbortController();
    HttpServer.serve({
      port,
      abortSignal: controller.signal,
      controllers: [ServerController],
    });
    let resp;
    await t.step("abort without error status (200)", async () => {
      resp = await fetch(`http://localhost:${port}/test1`);
      assertEquals(resp.status, 200);
      assertEquals(await resp.text(), "");
    });
    await t.step("abort with error status (403)", async () => {
      resp = await fetch(`http://localhost:${port}/test2`);
      assertEquals(resp.status, 403);
      assertEquals(await resp.text(), "");
    });
    controller.abort();
    await sleep(100);
  },
});
