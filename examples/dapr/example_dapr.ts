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

import {
  Bind,
  Bindings,
  publish,
  Secrets,
  start,
  Subscribe,
} from "../../decorators/dapr.decorator.ts";

const TELEGRAM_CHATID = await Secrets.get({
  store: "example-secrets-store",
  key: "TELEGRAM_CHATID",
});
const TELEGRAM_TOKEN = await Secrets.get({
  store: "example-secrets-store",
  key: "TELEGRAM_TOKEN",
});
const PUBSUBNAME = "pubsub";

class DaprApp {
  @Subscribe({ pubSubName: PUBSUBNAME, topic: "A" })
  topicA({ data }: { data: unknown }) {
    console.log("topicA =>", data);
  }

  @Subscribe({ pubSubName: PUBSUBNAME, topic: "B" })
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

  @Subscribe({
    pubSubName: PUBSUBNAME,
    topic: "C",
    metadata: { rawPayload: "true" },
  })
  topicC(raw: Record<string, unknown>) {
    console.log("topicC =>", raw);
  }

  @Bind("tweets")
  tweets({ text }: { text: Record<string, unknown> }) {
    publish({
      data: { text },
      pubSubName: PUBSUBNAME,
      topic: "A",
    });
  }
}

console.log("Dapr app started...");
start({ appPort: 3000, controllers: [DaprApp] });
