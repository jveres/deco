/**
 * Copyright 2022 Janos Veres. All rights reserved.
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file.
 */

import {
  HttpResponse,
  HttpServer,
} from "../decorators/httpserver.decorator.ts";
import { SSE } from "../utils/sse.ts";
import { memoize } from "../utils/memoize.ts";
import { Multicast } from "https://deno.land/x/channel@0.0.1/mod.ts";
import { delay } from "https://deno.land/std@0.133.0/async/mod.ts";
import { deadline } from "https://deno.land/std@0.133.0/async/mod.ts";
import { abortable } from "https://deno.land/std@0.133.0/async/mod.ts";

const CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours

const multicast = new class {
  constructor(private multicast = new Multicast<string>(), private ticker = 0) {
    this.multicast.onReceiverAdded = () =>
      console.log(`receiver added (${this.multicast.size})`);
    this.multicast.onReceiverRemoved = () =>
      console.log(`receiver removed (${this.multicast.size})`);
    const ws = new WebSocket("wss://ws.bitstamp.net/");
    ws.onopen = () => {
      console.log("subscribing to BTCUSD trades @ bitstamp");
      ws.send(
        JSON.stringify({
          "event": "bts:subscribe",
          "data": { "channel": "live_trades_btcusd" },
        }),
      );
    };
    ws.onmessage = (m) => {
      const data = JSON.parse(m.data);
      const price = data?.data?.price;
      if (price) {
        const tick = `BTCUSD: ${price}`;
        console.info(tick);
        this.multicast.push(tick);
      }
    };
    setInterval(() => {
      const tick = `tick: ${this.ticker++}, receivers: ${this.multicast.size}`;
      console.info(tick);
      this.multicast.push(tick);
    }, 5_000);
  }

  [Symbol.asyncIterator]() {
    return this.multicast[Symbol.asyncIterator]();
  }
}();

class TestServer {
  @HttpServer.Get()
  dummy() {
    return new Response();
  }

  @HttpServer.Route({ method: "GET" })
  bench() {
    return new Response("Hello from Bench!");
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
    await delay(1_000);
    console.timeEnd("sleep");
    return new Response("Hello from Deco! 😎");
  }

  @HttpServer.Get()
  @HttpServer.Wrap((fn) =>
    deadline(fn(), 100).catch(() => new Response(null, { status: 408 }))
  )
  async deadline() {
    await delay(1_000);
    return new Response("Hello from Deco! 😎");
  }

  @HttpServer.Get()
  @HttpServer.Wrap((fn) => {
    const abortController = new AbortController();
    setTimeout(() => abortController.abort(), 200);
    return abortable(fn(), abortController.signal).catch(() =>
      new Response(null, { status: 500 })
    );
  })
  async abort() {
    await delay(1_000);
    return new Response("Hello from Deco! 😎");
  }

  @HttpServer.Get("/cached/:id")
  @HttpServer.Wrap((fn, { path, urlParams }) => {
    const params = new URLSearchParams(urlParams);
    return memoize<HttpResponse>(fn, {
      ttl: (Number(params.get("ttl")) || 5) * 1000,
      key: () => path,
      get: (r) => r.clone(),
      set: (r) => r.clone(),
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

  @HttpServer.Static({
    assets: [
      { fileName: "index.html", path: "/", contentType: "text/html" },
    ],
  })
  @HttpServer.Before(() => ({
    headers: { "cache-control": `public, max-age=${CACHE_TTL / 1000};` },
  }))
  index() {}

  @HttpServer.Get()
  @HttpServer.Before((req) => {
    const params = new URLSearchParams(req.urlParams);
    const user = params.get("user");
    if (!user) {
      return new Response(null, { status: 401 });
    }
    Object.assign(req, { payload: { user, role: "admin" } });
  })
  async *chunked({ payload }: { payload: Record<string, string> }) {
    console.log("payload =", payload);
    yield this.#priv + "\n\n";
    for (let i = 1; i <= 10; i++) {
      await delay(1000);
      yield i + "\n\n";
    }
  }

  @HttpServer.Get()
  @HttpServer.Before(() => ({
    headers: { "content-type": "text/event-stream" },
  }))
  async *stream({ signal }: { signal: AbortSignal }) {
    const stream = multicast[Symbol.asyncIterator]();
    try {
      yield SSE({ comment: this.#priv });
      for await (const tick of abortable(stream, signal)) {
        yield SSE({ event: "tick", data: `${tick}` });
      }
    } finally {
      stream.return?.();
    }
  }

  @HttpServer.Get()
  ws({ http }: { http: Deno.RequestEvent }) {
    if (http.request.headers.get("upgrade") !== "websocket") {
      return new Response(null, { status: 501 });
    }
    const controller = new AbortController();
    const { socket: ws, response } = Deno.upgradeWebSocket(http.request);
    ws.onopen = async () => {
      console.log("websocket connected");
      const stream = multicast[Symbol.asyncIterator]();
      try {
        ws.send(this.#priv);
        for await (const tick of abortable(stream, controller.signal)) {
          ws.send(tick);
        }
      } catch (e) {
        if (!(e instanceof DOMException)) throw e;
      } finally {
        stream.return?.();
      }
    };
    ws.onmessage = ({ data }) => {
      console.info("websocket message reveiced:", data);
    };
    ws.onclose = () => {
      console.log("websocket closed");
      controller.abort();
    };
    ws.onerror = (e) => console.error("websocket error:", e);
    return response;
  }
}

const shutdown = new AbortController();
Deno.addSignalListener("SIGINT", () => {
  shutdown.abort();
});

HttpServer.serve({
  signal: shutdown.signal,
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
    Deno.exit();
  },
});
