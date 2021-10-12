// Copyright 2021 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// Run the example:
//    dapr --app-id deno-app --app-port 3000 run -- deno run -A --unstable --watch example_dapr.ts
// Start Dapr sidecar in local environment:
//    dapr run --app-id sidecar --dapr-http-port 3500
// Publish messages through the sidecar:
//    dapr publish --publish-app-id sidecar --pubsub pubsub --topic A --data '{"data": "message for topic A"}'

import * as Dapr from "../../decorators/dapr.decorator.ts";

const pubSubName = "pubsub";

class DaprClient {
  @Dapr.Subscribe({ pubSubName, topic: "A" })
  topicA({ data }: { data: any }) {
    console.log("topicA =>", data);
  }

  @Dapr.Subscribe({ pubSubName, topic: "B" })
  topicB({ data }: { data: any }) {
    console.log("topicB =>", data);
  }

  @Dapr.Subscribe({ pubSubName, topic: "C", metadata: { rawPayload: "true" } })
  topicC(raw: any) {
    console.log("topicC =>", raw);
  }
}

console.log("Dapr app started...");
Dapr.start([DaprClient]);
