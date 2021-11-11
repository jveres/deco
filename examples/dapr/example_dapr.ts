// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

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
//    curl -X POST "http://localhost:3500/v1.0/actors/TestActor/1/method/testMethod1" -d "{test: 'data'}"

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
    console.log(`Tweet => "${text}"`);
  }
}

@Dapr.AppController()
class TestActor1 {
  private counter = 0;

  @Actor.event()
  activate(data: unknown) {
    console.log("TestActor activated =>", data);
  }

  @Actor.event()
  deactivate(data: unknown) {
    console.log("TestActor deactivated =>", data);
  }

  @Actor.method()
  testMethod1() {
    console.log("TestActor/test() method called, counter=", this.counter++);
  }
}

@Dapr.AppController()
class TestActor2 {
  private readonly tag = "TestActor2";

  @Actor.event()
  activate(data: unknown) {
    console.log("TestActor1 activated =>", data);
  }

  @Actor.event()
  deactivate(data: unknown) {
    console.log("TestActor1 deactivated =>", data);
  }

  @Actor.method()
  testMethod1(data: unknown) {
    console.log("TestActor1/test() method called =>", data, this);
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
  controllers: [
    PubSubExample1,
    PubSubExample2,
    PubSubExample3,
    ServiceExample1,
    TestActor1,
    TestActor2,
  ],
});
