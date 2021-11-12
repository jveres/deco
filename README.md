[![Deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/deco/mod.ts)

# Deco (**deh** · kow) is a lightweight helper library for [Deno](https://deno.land) developers (still work in progress)

- Fault tolerance helpers (@Timeout, @Retry, @Try, @Trace, @Debounce, @Throttle, @RateLimit, @Concurrecy, @Memoize)
- REST @Http API helpers with OpenAPI support
- @Dapr helpers (Service, PubSub, Bindings, State, Secrets, Actor) for resilient cloud native Deno microservices/actors

## Server [example](examples/example_server.ts)
```typescript
import { Http } from "../decorators/httpserver.decorator.ts";

@Http.ServerController({ schema: "api.yaml" })
class ExampleOpenAPI {}

@Http.ServerController()
class ExampleCustomAPI {
  counter = 0;

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
      }", counter="${++this.counter}")`,
    };
  }

  @Http.Get("/static/*")
  static({ "*": path }: { "*": string }) {
    return {
      body: `[GET /static/*] 😎 (got path: "${path}")`,
    };
  }
}

@Http.ServerController()
class ExampleStream {
  counter = 0;

  @Http.Get("/stream")
  stream() {
    let cancelled = true;
    // deno-lint-ignore no-this-alias
    const self = this;
    const stream = new ReadableStream({
      start(controller) {
        cancelled = false;
        console.log("Stream started");
        controller.enqueue(": Welcome to the /sse endpoint!\n\n");
        (function time() {
          setTimeout(() => {
            if (!cancelled) {
              const body = `event: timer, counter\ndata: ${
                new Date().toISOString()
              }, ${++self.counter}\n\n\n`;
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
Http.serve({ controllers: [ExampleOpenAPI, ExampleCustomAPI, ExampleStream] });
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
// Invoke "test" service
//    dapr invoke --app-id deco-app --verb GET --method test
// Send data to the actor
//    curl -X POST "http://localhost:3500/v1.0/actors/TestActor1/1/method/testMethod1" -d "{test: 'data'}"

import {
  Actor,
  Bindings,
  Dapr,
  PubSub,
  Secrets,
  Service,
  State,
} from "../../decorators/dapr.decorator.ts";

const { TELEGRAM_CHATID, TELEGRAM_TOKEN } = await Secrets.getBulk({
  store: "example-secrets-store",
});

const pubSubName = "pubsub";

@Dapr.AppController({ pubSubName })
class PubSubExample1 {
  private s = "private1";
  @PubSub.subscribeTo()
  A({ data }: { data: unknown }) {
    console.log("topicA =>", data, this);
  }

  @PubSub.subscribeTo()
  B({ data }: { data: Record<string, unknown> }) {
    console.log("topicB =>", data, this);
    if (data.text && TELEGRAM_CHATID && TELEGRAM_TOKEN) {
      const { text } = data;
      const path =
        `/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHATID}&text=${text}`;
      Bindings.invoke({
        bindingName: "telegram",
        operation: "GET",
        metadata: { path },
      });
    }
  }
}

@Dapr.AppController({ pubSubName })
class PubSubExample2 {
  private s = "private2";
  @PubSub.subscribeTo({ metadata: { rawPayload: "true" } })
  C(raw: Record<string, unknown>) {
    console.log("topicC =>", raw, this);
  }
}

@Dapr.AppController()
class PubSubExample3 {
  private s = "private3";
  @PubSub.subscribeTo({ pubSubName })
  D({ data }: { data: unknown }) {
    console.log("topicD =>", data, this);
    console.log("publishing to topic A");
    PubSub.publish({
      pubSubName,
      topicName: "A",
      data,
    });
  }
}

@Dapr.AppController()
class ServiceExample1 {
  private counter = 0;

  @Service.expose()
  async test({ request }: { request: Request }) {
    // deno-fmt-ignore
    console.log(`test service called, counter: ${++this.counter}, data = "${await request.text()}"`);
    return {
      body: `test reply, counter: ${this.counter}`,
    };
  }

  @Bindings.listenTo()
  tweets({ text }: { text: Record<string, unknown> }) {
    console.log(`🐦  => "${text}"`);
  }
}

@Dapr.AppController()
class TestActor1 {
  private counter = 0;

  @Actor.event()
  activate({ actorType, actorId }: { actorType: string; actorId: string }) {
    console.log("TestActor1 activated", this);
    this.counter = 0;
    Actor.setReminder({
      actorType,
      actorId,
      reminderName: "reminder",
      period: "5s",
    });
  }

  @Actor.event()
  async deactivate({ actorType, actorId }: { actorType: string; actorId: string }) {
    console.log("TestActor1 deactivation", this);
    const reminder = await Actor.getReminder({actorType, actorId, reminderName: "reminder"});
    console.log("reminder =>", reminder);
    await Actor.deleteReminder({ actorType, actorId, reminderName: "reminder" });
  }

  @Actor.event()
  reminder() {
    console.log("TestActor1 reminder called");
  }

  @Actor.method()
  async testMethod1({ request }: { request: Request }) {
    const data = await request.text();
    console.log(
      "TestActor1/testMethod1() called, data =",
      data,
      ", counter =",
      ++this.counter,
    );
  }
}

@Dapr.AppController()
class TestActor2 {
  private readonly tag = "TestActor2";

  @Actor.method()
  testMethod1({ actorType, actorId }: { actorType: string; actorId: string }) {
    console.log("TestActor2/testMethod1() called,", this);
    Actor.setTimer({ actorType, actorId, timerName: "timer", dueTime: "10s" });
  }

  @Actor.event()
  timer() {
    console.log("TestActor2/timer fired");
  }
}

// Setting and getting state
await State.set({
  storename: "example-state-store",
  data: [{ key: "key1", value: "value1" }, { key: "key3", value: "value3" }],
});
// deno-fmt-ignore
console.log("key1=", await State.get({ storename: "example-state-store", key: "key1" }));
// deno-fmt-ignore
console.log("missing=", await State.get({storename: "example-state-store", key: "missing" }));
// deno-fmt-ignore
console.log("bulk=", await State.getBulk({storename: "example-state-store", data: { keys: ["key1", "missing", "key3"] }}));

console.log("Dapr app started...");
Dapr.start({
  appPort: 3000,
  actorIdleTimeout: "5s",
  controllers: [
    PubSubExample1,
    PubSubExample2,
    PubSubExample3,
    ServiceExample1,
    TestActor1,
    TestActor2,
  ],
});
```
## Running tests
```sh
deno test --allow-net
```
## Http server performance (~90k RPS on MBP/M1)
![Http server benchmark](images/bench.png)

![Alt](https://repobeats.axiom.co/api/embed/65f6f2f7d5aacd6dd7e28591bd3878d151d34f6a.svg "Repobeats analytics image")