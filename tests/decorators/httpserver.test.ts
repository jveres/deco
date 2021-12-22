// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../../decorators/httpserver.decorator.ts";
import { assertEquals } from "https://deno.land/std@0.119.0/testing/asserts.ts";

const port = 8090;

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

Deno.test({
  name: "@HttpServer methods",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    HttpServer.serve({ port, controllers: [ServerController] });
    let resp;
    await t.step("GET", async () => {
      resp = await fetch(`http://localhost:${port}/get1`);
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/get2`);
      assertEquals(resp.status, 200);
    });
    await t.step("POST", async () => {
      resp = await fetch(`http://localhost:${port}/post1`, {method: "POST"});
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/post2`, {method: "POST"});
      assertEquals(resp.status, 200);
    });
    await t.step("PUT", async () => {
      resp = await fetch(`http://localhost:${port}/put1`, {method: "PUT"});
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/put2`, {method: "PUT"});
      assertEquals(resp.status, 200);
    });
    await t.step("DELETE", async () => {
      resp = await fetch(`http://localhost:${port}/delete1`, {method: "DELETE"});
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/delete2`, {method: "DELETE"});
      assertEquals(resp.status, 200);
    });
    await t.step("OPTIONS", async () => {
      resp = await fetch(`http://localhost:${port}/options1`, {method: "OPTIONS"});
      assertEquals(resp.status, 200);
      resp = await fetch(`http://localhost:${port}/options2`, {method: "OPTIONS"});
      assertEquals(resp.status, 200);
    });
  },
});
