// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// Run the example:
//    dapr --app-id deco-app --app-port 3000 --components-path components run -- deno run -A --unstable --watch example_dapr.ts
// Start Dapr sidecar in local environment:
//    dapr run --app-id sidecar --dapr-http-port 3500
// Publish messages through the sidecar:
//    dapr publish --publish-app-id sidecar --pubsub pubsub --topic A --data '{"data": "message for topic A"}'

import {
  Bind,
  binding,
  publish,
  start,
  Subscribe,
} from "../../decorators/dapr.decorator.ts";

const pubSubName = "pubsub";

const TELEGRAM_CHATID = Deno.env.get("TELEGRAM_CHATID");
const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN");

class DaprApp {
  @Subscribe({ pubSubName, topic: "A" })
  topicA({ data }: { data: unknown }) {
    console.log("topicA =>", data);
  }

  @Subscribe({ pubSubName, topic: "B" })
  topicB({ data }: { data: Record<string, unknown> }) {
    console.log("topicB =>", data);
    // deno-fmt-ignore
    if (data.text && TELEGRAM_CHATID && TELEGRAM_TOKEN) {
      const { text } = data;
      const path = `/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHATID}&text=${text}`;
      binding({
        name: "telegram",
        operation: "get",
        metadata: { path },
      });
    }
  }

  @Subscribe({ pubSubName, topic: "C", metadata: { rawPayload: "true" } })
  topicC(raw: Record<string, unknown>) {
    console.log("topicC =>", raw);
  }

  @Bind("tweets")
  tweets({ text }: { text: Record<string, unknown> }) {
    publish({
      data: { text },
      pubSubName,
      topic: "A",
    });
  }
}

console.log("Dapr app started...");
start({ appPort: 3000, controllers: [DaprApp] });
