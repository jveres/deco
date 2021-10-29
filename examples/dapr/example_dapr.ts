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
class _ {
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
class __ {
  counter = 0;

  @Actor.registerEventHandler({
    actorType: "testActor",
    event: ActorEvent.Activate,
  })
  activate({ actorId }: { actorId: string }) {
    this.counter = 0;
    console.log(`testActor with actorId="${actorId}" activated, counter reset`);
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
    methodName: "testMethod1",
  })
  async actor1(
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
  async actor2(
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
      // Invoke self asynchronously, awaiting for the same actor causes infinite-loop (or timeout)
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
      await State.get({ storename: "example-state-store", key: "key1" }),
    )
  }`,
);
console.log(
  `missing=${
    JSON.stringify(
      await State.get({ storename: "example-state-store", key: "missing" }),
    )
  }`,
);
console.log(
  `bulk=${
    JSON.stringify(
      await State.getBulk({
        storename: "example-state-store",
        data: { keys: ["key1", "missing", "key3"] },
      }),
    )
  }`,
);

console.log("Dapr app started...");
Dapr.start({ appPort: 3000, actorIdleTimeout: "5s" });
