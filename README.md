[![Deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/deco@0.6.2/mod.ts)

# Deco (**deh** · kow) is a lightweight helper library for [Deno](https://deno.land) developers (still work in progress)

- Fault tolerance helpers (@Timeout, @Retry, @Try, @Trace, @Debounce, @Throttle, @RateLimit, @Concurrecy, @Memoize)
- REST API helpers (@Http.xxx) with OpenAPI support
- Dapr helpers (@Dapr.xxx) for resilient cloud native Deno microservices/actors

## Server [example](examples/example_server.ts)
```typescript
import { Http } from "../decorators/httpserver.decorator.ts";

@Http.Server({ schema: "api.yaml" })
class OpenAPIServer {}

@Http.Server()
class ExampleServer {
  @Http.Get("/api/:id")
  get({ id, url }: { id: string; url: URL }) {
    return {
      body: `[GET /api/:id] 😎 (got id: "${id}", query: "${
        decodeURIComponent(url.searchParams.toString())
      }")`,
    };
  }

  @Http.Post("/api")
  async post({ url, request }: { url: URL; request: Request }) {
    return {
      body: `[POST /api/:id] 😎 (got data: "${await request.text()}", query: "${
        decodeURIComponent(url.searchParams.toString())
      }")`,
    };
  }

  @Http.Get("/static/*")
  static({ "*": path }: { "*": string }) {
    return {
      body: `[GET /static/*] 😎 (got path: "${path}")`,
    };
  }

  @Http.Get("/sse")
  stream() {
    let cancelled = true;
    const stream = new ReadableStream({
      start: (controller) => {
        cancelled = false;
        console.log("Stream started");
        controller.enqueue(": Welcome to the /sse endpoint!\n\n");
        (function time() {
          setTimeout(() => {
            if (!cancelled) {
              const body = `event: timer\ndata: ${
                new Date().toISOString()
              }\n\n\n`;
              controller.enqueue(body);
              time();
            }
          }, 1000);
        })();
      },
      cancel() {
        cancelled = true;
        console.log("Stream cancelled");
      },
    });
    return {
      body: stream.pipeThrough(new TextEncoderStream()),
      init: { headers: { "content-type": "text/event-stream" } },
    };
  }
}

console.log("Server started...");
Http.serve();
```

## [Dapr](https://dapr.io) [example](examples/dapr/example_dapr.ts)
```typescript
// Start Dapr sidecar in local environment:
//    dapr run --app-id sidecar --dapr-http-port 3500 --components-path ./components
// Run the example:
//    dapr --app-id deco-app --app-port 3000 --components-path ./components run -- deno run -A --unstable --watch example_dapr.ts
// Publish message to topic A:
//    dapr publish --publish-app-id sidecar --pubsub pubsub --topic A --data '{"data": "message for topic A"}'
// Publish message to topic B and get Telegrom notification (needs TELEGRAM_TOKEN and TELEGRAM_CHATID exist in the secrets store):
//    dapr publish --publish-app-id sidecar --pubsub pubsub --topic B --data '{"text": "Hello from Deco.Dapr!"}'
// Publish message to topic C to see raw message format:
//    dapr publish --publish-app-id sidecar --pubsub pubsub --topic C --data '{"raw": "raw message for topic C"}'
// Send data to the actor
//    curl -X POST "http://localhost:3500/v1.0/actors/testActor/1/method/testMethod1" -d "{test: 'data'}"

import {
  Actor,
  ActorEvent,
  Bindings,
  Dapr,
  PubSub,
  Secrets,
  Service,
  State,
} from "../../decorators/dapr.decorator.ts";
import { sleep } from "../../utils/utils.ts";

const { TELEGRAM_CHATID, TELEGRAM_TOKEN } = await Secrets.getBulk({
  store: "example-secrets-store",
});
const PUBSUBNAME = "pubsub";

@Dapr.App()
class _ExampleApp {
  @PubSub.subscribe({ pubSubName: PUBSUBNAME, topic: "A" })
  topicA({ data }: { data: unknown }) {
    console.log("topicA =>", data);
  }

  @PubSub.subscribe({ pubSubName: PUBSUBNAME, topic: "B" })
  topicB({ data }: { data: Record<string, unknown> }) {
    console.log("topicB =>", data);
    if (data.text && TELEGRAM_CHATID && TELEGRAM_TOKEN) {
      const { text } = data;
      const path =
        `/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHATID}&text=${text}`;
      Bindings.invoke({
        name: "telegram",
        operation: "get",
        metadata: { path },
      });
    }
  }

  @PubSub.subscribe({
    pubSubName: PUBSUBNAME,
    topic: "C",
    metadata: { rawPayload: "true" },
  })
  topicC(raw: Record<string, unknown>) {
    console.log("topicC =>", raw);
  }

  @Bindings.listenTo({ name: "tweets" })
  tweets({ text }: { text: Record<string, unknown> }) {
    PubSub.publish({
      data: { text },
      pubSubName: PUBSUBNAME,
      topic: "A",
    });
  }

  private counter = 0;

  @Service.expose({ name: "test", verb: "GET" })
  async test({ request }: { request: Request }) {
    console.log(
      `test service called, counter: ${++this.counter}, data = "${await request
        .text()}"`,
    );
    await sleep(4000);
    return {
      body: `test reply, counter: ${this.counter}`,
    };
  }
}

@Dapr.App()
class _ExampleActor {
  counter = 0;

  @Actor.registerEventHandler({
    actorType: "testActor",
    event: ActorEvent.Activate,
  })
  async activate(
    { actorType, actorId }: { actorType: string; actorId: string },
  ) {
    this.counter = 0;
    console.log(
      `testActor with actorId="${actorId}" activated, counter reset\nCreating reminder and timer...`,
    );
    await Actor.createReminder({
      actorType,
      actorId,
      reminderName: "testReminder",
      dueTime: "20s",
      period: "0",
    });
    await Actor.createTimer({
      actorType,
      actorId,
      timerName: "testTimer",
      dueTime: "5s",
      period: "0s",
    });
  }

  @Actor.registerEventHandler({
    actorType: "testActor",
    event: ActorEvent.Deactivate,
  })
  deactivate({ actorId }: { actorId: string }) {
    console.log(`testActor with actorId="${actorId}" deactivated`);
  }

  @Actor.registerMethod({
    actorType: "testActor",
    methodName: "testReminder",
  })
  testReminder(
    { actorType, actorId, methodName }: {
      actorType: string;
      actorId: string;
      methodName: string;
    },
  ) {
    console.log(
      `⏱ Actor reminder invoked, actorType="${actorType}", actorId="${actorId}", reminder="${methodName}"`,
    );
  }

  @Actor.registerMethod({
    actorType: "testActor",
    methodName: "testTimer",
  })
  testTimer(
    { actorType, actorId, methodName }: {
      actorType: string;
      actorId: string;
      methodName: string;
    },
  ) {
    console.log(
      `⏰ Actor timer invoked, actorType="${actorType}", actorId="${actorId}", reminder="${methodName}"`,
    );
  }

  @Actor.registerMethod({
    actorType: "testActor",
    methodName: "testMethod1",
  })
  async testMethod1(
    { actorId, request }: { actorId: string; request: Request },
  ) {
    const data = await request.text();
    console.log(
      `actor invoked with data="${data}", actorType="testActor", actorId="${actorId}", method="testMethod"`,
    );
    return `counter: ${++this.counter}`;
  }

  @Actor.registerMethod({
    actorType: "testActor",
    methodName: "testMethod2",
  })
  async testMethod2(
    { actorType, actorId, methodName, request }: {
      actorType: string;
      actorId: string;
      methodName: string;
      request: Request;
    },
  ) {
    const data = await request.text();
    console.log(
      `actor invoked with data="${data}", actorType="${actorType}", actorId="${actorId}", method="${methodName}"`,
    );
    if (this.counter < 10) {
      // Invokes itself asynchronously
      Actor.invoke({
        actorType,
        actorId,
        methodName,
        data: `test data from myself, counter=${this.counter}`,
      });
    }
    return `counter: ${++this.counter}`;
  }
}

// Setting and getting state
await State.set({
  storename: "example-state-store",
  data: [{ key: "key1", value: "value1" }, { key: "key3", value: "value3" }],
});
console.log(
  `key1=${
    JSON.stringify(
      await (await State.get({ storename: "example-state-store", key: "key1" }))
        .text(),
    )
  }`,
);
console.log(
  `missing=${
    JSON.stringify(
      await (await State.get({
        storename: "example-state-store",
        key: "missing",
      })).text(),
    )
  }`,
);
console.log(
  `bulk=${
    JSON.stringify(
      await (await State.getBulk({
        storename: "example-state-store",
        data: { keys: ["key1", "missing", "key3"] },
      })).text(),
    )
  }`,
);

console.log("Dapr app started...");
Dapr.start({ appPort: 3000, actorIdleTimeout: "5s" });
```
## Running tests
```sh
deno test --allow-net
```
## Http server performance (~90k RPS on MBP/M1)
![Http server benchmark](images/bench.png)