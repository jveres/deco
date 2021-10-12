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
  publish,
  start,
  Subscribe,
} from "../../decorators/dapr.decorator.ts";

const pubSubName = "pubsub";

class DaprApp {
  @Subscribe({ pubSubName, topic: "A" })
  topicA({ data }: { data: any }) {
    console.log("topicA =>", data);
  }

  @Subscribe({ pubSubName, topic: "B", metadata: { rawPayload: "true" } })
  topicC(raw: any) {
    console.log("topicB =>", raw);
  }

  @Bind("tweets")
  tweets({ text }: { text: string }) {
    publish({
      data: { text },
      pubSubName,
      topic: "A",
    });
  }
}

console.log("Dapr app started...");
start({ appPort: 3000, daprPort: 3500, controllers: [DaprApp] });
