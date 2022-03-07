// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { HttpServer } from "../decorators/httpserver.decorator.ts";
import { SSE } from "../utils/utils.ts";
import { memoize } from "../utils/memoize.ts";
import { delay } from "https://deno.land/std@0.128.0/async/mod.ts";
import { deadline } from "https://deno.land/std@0.128.0/async/mod.ts";
import { abortable } from "https://deno.land/std@0.128.0/async/abortable.ts";

class TestServer {
  @HttpServer.Get()
  dummy() {
    return new Response();
  }

  @HttpServer.Get()
  test() {
    return new Response("Hello from Deco! 😎");
  }

  @HttpServer.Get()
  @HttpServer.Before((_) => {
    return new Response(null, { status: 406 });
  })
  before() {
    return new Response("Hello from Deco! 😎");
  }

  @HttpServer.Get()
  async sleep() {
    console.time("sleep");
    await delay(1000);
    console.timeEnd("sleep");
    return new Response("Hello from Deco! 😎");
  }

  @HttpServer.Get()
  @HttpServer.Wrap((fn) =>
    deadline(fn(), 100).catch(() => new Response(null, { status: 408 }))
  )
  async deadline() {
    await delay(1000);
    return new Response("Hello from Deco! 😎");
  }

  @HttpServer.Get()
  @HttpServer.Wrap((fn) => {
    const abortController = new AbortController();
    setTimeout(() => abortController.abort(), 100);
    return abortable(fn(), abortController.signal).catch(() =>
      new Response(null, { status: 500 })
    );
  })
  async abort() {
    await delay(1000);
    return new Response("Hello from Deco! 😎");
  }

  @HttpServer.Get("/cached/:id")
  @HttpServer.Wrap((fn, { path, urlParams }) => {
    const params = new URLSearchParams(urlParams);
    return memoize<Response>(fn, {
      ttl: (Number(params.get("ttl")) || 5) * 1000,
      key: () => path,
      get(response) {
        return (response as Response).clone();
      },
      set(response) {
        return response.clone();
      },
    });
  })
  async cached({ pathParams }: { pathParams?: Record<string, unknown> }) {
    await delay(1000);
    return new Response(
      "Hello from Deco! 😎, pathParams=" + JSON.stringify(pathParams),
    );
  }

  @HttpServer.Get()
  redirect() {
    return Response.redirect("http://127.0.0.1:8080/priv");
  }

  @HttpServer.Get()
  error() {
    throw Error("error");
    // deno-lint-ignore no-unreachable
    return new Response("Never returns! 😎");
  }

  #priv = "Hello from Deco ! (#priv)";

  @HttpServer.Get()
  @HttpServer.Wrap((fn) => fn())
  priv() {
    return new Response(this.#priv);
  }

  @HttpServer.Get()
  @HttpServer.Before(({ urlParams }) => {
    const params = new URLSearchParams(urlParams);
    if (!params.get("user")) {
      return new Response(null, { status: 401 });
    }
  })
  async *chunked() {
    yield this.#priv + "\n\n";
    for (let i=1; i<=10; i++) {
      await delay(1000);
      yield i + "\n\n";
    }
  }

  @HttpServer.Get()
  async *stream() {
    yield {
      headers: {
        "content-type": "text/event-stream",
      },
    };
    yield SSE({ comment: this.#priv });
    while (true) {
      await delay(1000);
      yield SSE({ event: "tick", data: new Date().toString() });
    }
  }
}

const shutdown = new AbortController();
Deno.addSignalListener("SIGINT", () => {
  shutdown.abort();
});

HttpServer.serve({
  abortSignal: shutdown.signal,
  controllers: [TestServer],
  port: 8080,
  log: false,
  onStarted() {
    console.info(`Deco (v:DEV) Http server started at :8080`);
  },
  onError(e: unknown) {
    console.error(e);
  },
  onClosed() {
    console.info(`...server at :8080 closed.`);
  },
});
